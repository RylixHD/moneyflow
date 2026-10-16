import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";
const db = new PrismaClient();
async function main() {
  if (process.env.NODE_ENV === "production")
    throw new Error("Demo seed is disabled in production.");
  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 12)
    throw new Error("Set DEMO_PASSWORD (at least 12 characters).");
  if (await db.user.findUnique({ where: { email: "demo@moneyflow.example" } }))
    throw new Error("Demo user already exists. Seed does not overwrite data.");
  await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: "Deniz Demo",
        email: "demo@moneyflow.example",
        verified: true,
        passwordHash: await argon2.hash(password),
        settings: { create: {} },
        categories: {
          create: [
            "Market",
            "Yemek",
            "Ulaşım",
            "Kira",
            "Maaş",
            "Freelance",
            "Eğlence",
          ].map((name) => ({ name })),
        },
      },
      include: { categories: true },
    });
    const bank = await tx.account.create({
      data: {
        userId: user.id,
        name: "Günlük hesabım",
        opening: "18000",
        currency: "TRY",
      },
    });
    await tx.account.create({
      data: {
        userId: user.id,
        name: "Birikim hesabım",
        kind: "SAVINGS",
        opening: "45000",
        currency: "TRY",
      },
    });
    await tx.account.create({
      data: {
        userId: user.id,
        name: "Döviz cüzdanım",
        kind: "WALLET",
        opening: "450",
        currency: "USD",
      },
    });
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(1);
      d.setUTCMonth(d.getUTCMonth() - i);
      for (const [name, amount, kind, day] of [
        ["Maaş", "42000", "INCOME", 1],
        ["Freelance", "8500", "INCOME", 5],
        ["Kira", "14000", "EXPENSE", 2],
        ["Market", String(4600 + i * 90), "EXPENSE", 3],
        ["Yemek", "2850", "EXPENSE", 7],
        ["Ulaşım", "1240", "EXPENSE", 9],
        ["Eğlence", "950", "EXPENSE", 11],
      ] as const) {
        d.setUTCDate(day);
        await tx.transaction.create({
          data: {
            userId: user.id,
            accountId: bank.id,
            categoryId: user.categories.find((c) => c.name === name)!.id,
            kind,
            amount,
            description: `${name} · örnek kayıt`,
            date: new Date(d),
          },
        });
      }
    }
    for (const [name, amount] of [
      ["Market", "6500"],
      ["Yemek", "4000"],
      ["Ulaşım", "2000"],
    ])
      await tx.budget.create({
        data: {
          userId: user.id,
          categoryId: user.categories.find((c) => c.name === name)!.id,
          amount,
          currency: "TRY",
          month: new Date().toISOString().slice(0, 7),
        },
      });
    const goal = await tx.savingsGoal.create({
      data: {
        userId: user.id,
        name: "Japonya seyahati",
        target: "90000",
        currency: "TRY",
        deadline: new Date(Date.now() + 240 * 86400000),
      },
    });
    await tx.savingsContribution.create({
      data: { userId: user.id, goalId: goal.id, amount: "36000" },
    });
    await tx.subscription.create({
      data: {
        userId: user.id,
        name: "Müzik aboneliği",
        amount: "99.99",
        currency: "TRY",
        period: "MONTHLY",
        nextPayment: new Date(Date.now() + 3 * 86400000),
      },
    });
  });
  console.log("Synthetic demo data created for demo@moneyflow.example.");
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
