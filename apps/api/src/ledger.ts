import { BadRequestException, Injectable, Inject } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Db } from "./db";
import { transactionSchema } from "./validation";
import { dec, nextDate } from "./finance";
type Client = Prisma.TransactionClient;
@Injectable()
export class Ledger {
  constructor(@Inject(Db) readonly db: Db) {}
  async validate(tx: Client, userId: string, body: unknown) {
    const data = transactionSchema.parse(body);
    const account = await tx.account.findFirst({
      where: { id: data.accountId, userId },
    });
    if (!account) throw new BadRequestException("Hesap bulunamadı.");
    if (
      data.categoryId &&
      !(await tx.category.findFirst({ where: { id: data.categoryId, userId } }))
    )
      throw new BadRequestException("Kategori bulunamadı.");
    if (data.kind === "TRANSFER") {
      const destination = await tx.account.findFirst({
        where: { id: data.destinationId ?? "", userId },
      });
      if (!destination || destination.id === account.id)
        throw new BadRequestException("Farklı bir hedef hesap seçin.");
      if (destination.currency !== account.currency) {
        if (!data.fxRate || !data.fxDate || !data.fxSource)
          throw new BadRequestException(
            "Döviz transferi için kur, kaynak ve tarih gerekli.",
          );
        data.receivedAmount = dec(data.amount)
          .mul(data.fxRate)
          .toDecimalPlaces(2)
          .toFixed(2);
      } else {
        data.receivedAmount = data.amount;
        data.fxRate = null;
        data.fxDate = null;
        data.fxSource = null;
      }
      data.categoryId = null;
    } else {
      data.destinationId = null;
      data.receivedAmount = null;
      data.fxRate = null;
      data.fxDate = null;
      data.fxSource = null;
    }
    return { ...data, userId };
  }
  async create(userId: string, body: unknown) {
    return this.db.$transaction(async (tx) =>
      tx.transaction.create({ data: await this.validate(tx, userId, body) }),
    );
  }
  async automate(userId: string) {
    await this.db.$transaction(async (tx) => {
      // Serialize each user's catch-up work, including concurrent browser requests.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
      const rules = await tx.recurringTransaction.findMany({
        where: { userId, active: true, nextDate: { lte: new Date() } },
      });
      for (const rule of rules) {
        let date = rule.nextDate,
          count = 0;
        while (date <= new Date() && count++ < 120) {
          await tx.transaction.upsert({
            where: { recurringKey: `${rule.id}:${date.toISOString()}` },
            update: {},
            create: {
              userId,
              accountId: rule.accountId,
              kind: rule.kind,
              amount: rule.amount,
              description: rule.description,
              date,
              recurringKey: `${rule.id}:${date.toISOString()}`,
            },
          });
          date = nextDate(date, rule.period);
        }
        await tx.recurringTransaction.update({
          where: { id: rule.id },
          data: { nextDate: date },
        });
      }
      const month = new Date().toISOString().slice(0, 7);
      const previous = await tx.budget.findMany({
        where: { userId, rollover: true, month: { lt: month } },
        orderBy: { month: "desc" },
      });
      const seen = new Set<string>();
      for (const budget of previous) {
        const key = `${budget.categoryId}:${budget.currency}`;
        if (seen.has(key)) continue;
        seen.add(key);
        await tx.budget.upsert({
          where: {
            userId_categoryId_currency_month: {
              userId,
              categoryId: budget.categoryId,
              currency: budget.currency,
              month,
            },
          },
          update: {},
          create: {
            userId,
            categoryId: budget.categoryId,
            currency: budget.currency,
            amount: budget.amount,
            month,
            rollover: true,
          },
        });
      }
    });
  }
  async snapshot(userId: string, currency: string, month: string) {
    await this.automate(userId);
    const start = new Date(`${month}-01T00:00:00Z`),
      end = nextDate(start, "MONTHLY");
    const yearStart = new Date(start);
    yearStart.setUTCMonth(yearStart.getUTCMonth() - 11);
    const [
      accounts,
      categories,
      budgets,
      goals,
      subscriptions,
      recurring,
      settings,
      groups,
      received,
      trend,
    ] = await Promise.all([
      this.db.account.findMany({ where: { userId } }),
      this.db.category.findMany({ where: { userId } }),
      this.db.budget.findMany({
        where: { userId, currency, month },
        include: { category: true },
      }),
      this.db.savingsGoal.findMany({
        where: { userId },
        include: { contributions: true },
      }),
      this.db.subscription.findMany({
        where: { userId },
        orderBy: { nextPayment: "asc" },
      }),
      this.db.recurringTransaction.findMany({ where: { userId } }),
      this.db.userSettings.findUnique({ where: { userId } }),
      this.db.transaction.groupBy({
        by: ["accountId", "kind"],
        where: { userId },
        _sum: { amount: true },
      }),
      this.db.transaction.groupBy({
        by: ["destinationId"],
        where: { userId, kind: "TRANSFER" },
        _sum: { receivedAmount: true },
      }),
      this.db.$queryRaw<
        { month: string; kind: string; amount: Prisma.Decimal }[]
      >`SELECT to_char(t.date,'YYYY-MM') AS month,t.kind,SUM(t.amount) AS amount FROM "Transaction" t JOIN "Account" a ON a.id=t."accountId" WHERE t."userId"=${userId} AND a.currency=${currency} AND t.date>=${yearStart} AND t.date<${end} AND t.kind!='TRANSFER' GROUP BY 1,2 ORDER BY 1`,
    ]);
    const totals = (kind: string, m = month) =>
      trend.find((x) => x.month === m && x.kind === kind)?.amount ?? dec(0);
    const accountRows = accounts.map((a) => ({
      ...a,
      balance: groups
        .filter((g) => g.accountId === a.id)
        .reduce(
          (sum, g) =>
            sum.plus(
              g.kind === "INCOME"
                ? (g._sum.amount ?? 0)
                : dec(g._sum.amount ?? 0).negated(),
            ),
          dec(a.opening),
        )
        .plus(
          received.find((g) => g.destinationId === a.id)?._sum.receivedAmount ??
            0,
        )
        .toFixed(2),
    }));
    const spending = await this.db.transaction.groupBy({
      by: ["categoryId"],
      where: {
        userId,
        kind: "EXPENSE",
        date: { gte: start, lt: end },
        account: { currency },
      },
      _sum: { amount: true },
    });
    const budgetRows = budgets.map((b) => ({
      ...b,
      spent: (
        spending.find((s) => s.categoryId === b.categoryId)?._sum.amount ??
        dec(0)
      ).toFixed(2),
    }));
    const goalRows = goals.map((g) => {
      const saved = g.contributions.reduce((s, c) => s.plus(c.amount), dec(0));
      const sorted = [...g.contributions].sort(
        (a, b) => a.date.getTime() - b.date.getTime(),
      );
      const elapsed = sorted.length
        ? Math.max(30, (Date.now() - sorted[0].date.getTime()) / 86400000)
        : 0;
      const remaining = Prisma.Decimal.max(0, g.target.minus(saved));
      const days =
        saved.gt(0) && elapsed
          ? remaining.div(saved.div(elapsed)).ceil().toNumber()
          : null;
      return {
        ...g,
        saved: saved.toFixed(2),
        estimatedDate:
          days !== null && days < 36500
            ? new Date(Date.now() + days * 86400000).toISOString()
            : null,
        estimateAssumption:
          "Geçmiş katkı hızı devam ederse; en az 30 günlük gözlem varsayımı.",
      };
    });
    const daily = await this.db.$queryRaw<
      { date: string; kind: string; amount: Prisma.Decimal }[]
    >`SELECT to_char(t.date,'YYYY-MM-DD') AS date,t.kind,SUM(t.amount) AS amount FROM "Transaction" t JOIN "Account" a ON a.id=t."accountId" WHERE t."userId"=${userId} AND a.currency=${currency} AND t.date>=${start} AND t.date<${end} AND t.kind!='TRANSFER' GROUP BY 1,2 ORDER BY 1`;
    if (settings?.notifications) {
      const messages: { key: string; message: string }[] = [];
      for (const b of budgetRows) {
        const ratio = dec(b.spent).div(b.amount).mul(100).toNumber();
        for (const limit of [50, 75, 90, 100])
          if (ratio >= limit)
            messages.push({
              key: `${b.id}:${limit}`,
              message: `${b.category.name} bütçesi %${limit} seviyesine ulaştı.`,
            });
      }
      for (const s of subscriptions)
        if (s.active && s.nextPayment <= new Date(Date.now() + 7 * 86400000))
          messages.push({
            key: `${s.id}:${s.nextPayment.toISOString()}`,
            message: `${s.name}: ${s.amount} ${s.currency}, ödeme tarihi ${s.nextPayment.toISOString().slice(0, 10)}`,
          });
      for (const g of goalRows)
        if (dec(g.saved).gte(g.target))
          messages.push({
            key: `goal:${g.id}`,
            message: `${g.name} birikim hedefine ulaştınız!`,
          });
      for (const item of messages)
        await this.db.notification.upsert({
          where: { key: item.key },
          update: {},
          create: { ...item, userId },
        });
    }
    const previous = new Date(start);
    previous.setUTCMonth(previous.getUTCMonth() - 1);
    const prev = previous.toISOString().slice(0, 7);
    return {
      currency,
      month,
      accounts: accountRows,
      categories,
      budgets: budgetRows,
      goals: goalRows,
      subscriptions,
      recurring,
      settings,
      totals: {
        balance: accountRows
          .filter((a) => a.currency === currency)
          .reduce((s, a) => s.plus(a.balance), dec(0))
          .toFixed(2),
        income: totals("INCOME").toFixed(2),
        expense: totals("EXPENSE").toFixed(2),
        net: totals("INCOME").minus(totals("EXPENSE")).toFixed(2),
        previousIncome: totals("INCOME", prev).toFixed(2),
        previousExpense: totals("EXPENSE", prev).toFixed(2),
        savings: goalRows
          .filter((g) => g.currency === currency)
          .reduce((s, g) => s.plus(g.saved), dec(0))
          .toFixed(2),
      },
      trend: Array.from({ length: 12 }, (_, i) => {
        const d = new Date(yearStart);
        d.setUTCMonth(d.getUTCMonth() + i);
        const m = d.toISOString().slice(0, 7);
        return {
          month: m,
          income: totals("INCOME", m).toFixed(2),
          expense: totals("EXPENSE", m).toFixed(2),
        };
      }),
      spending: spending.map((s) => ({
        name: categories.find((c) => c.id === s.categoryId)?.name ?? "Diğer",
        amount: s._sum.amount?.toFixed(2) ?? "0",
      })),
      daily: Array.from(
        {
          length: new Date(
            Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
          ).getUTCDate(),
        },
        (_, i) => {
          const date = `${month}-${String(i + 1).padStart(2, "0")}`;
          return {
            date,
            income:
              daily
                .find((d) => d.date === date && d.kind === "INCOME")
                ?.amount.toFixed(2) ?? "0",
            expense:
              daily
                .find((d) => d.date === date && d.kind === "EXPENSE")
                ?.amount.toFixed(2) ?? "0",
          };
        },
      ),
      notifications: await this.db.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    };
  }
}
