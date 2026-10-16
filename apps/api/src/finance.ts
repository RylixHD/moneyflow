import { Prisma } from "@prisma/client";
export const dec = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);
export function nextDate(date: Date, period: string) {
  const result = new Date(date),
    day = date.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + (period === "YEARLY" ? 12 : 1));
  const last = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(day, last));
  return result;
}
export function accountBalance(
  account: { id: string; opening: Prisma.Decimal.Value },
  rows: {
    accountId: string;
    destinationId: string | null;
    kind: string;
    amount: Prisma.Decimal.Value;
    receivedAmount: Prisma.Decimal.Value | null;
  }[],
) {
  return rows.reduce(
    (sum, row) =>
      sum.plus(
        row.accountId === account.id
          ? row.kind === "INCOME"
            ? dec(row.amount)
            : dec(row.amount).negated()
          : row.destinationId === account.id
            ? dec(row.receivedAmount ?? row.amount)
            : 0,
      ),
    dec(account.opening),
  );
}
export function safeCell(value: string) {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}
