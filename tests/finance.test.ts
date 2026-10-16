import { test } from "node:test";
import assert from "node:assert/strict";
import {
  accountBalance,
  dec,
  nextDate,
  safeCell,
} from "../apps/api/src/finance";
import { transactionSchema } from "../apps/api/src/validation";
test("decimal amounts do not accumulate binary floating point errors", () => {
  assert.equal(dec("0.1").plus("0.2").toFixed(2), "0.30");
});
test("transfers conserve funds and respect destination currency amount", () => {
  const rows = [
    {
      accountId: "a",
      destinationId: "b",
      kind: "TRANSFER",
      amount: "125.15",
      receivedAmount: "4.17",
    },
  ];
  assert.equal(
    accountBalance({ id: "a", opening: "1000" }, rows).toFixed(2),
    "874.85",
  );
  assert.equal(
    accountBalance({ id: "b", opening: "0" }, rows).toFixed(2),
    "4.17",
  );
  assert.equal(
    accountBalance({ id: "c", opening: "10" }, rows).toFixed(2),
    "10.00",
  );
});
test("month-end recurrence clamps to calendar month, including leap year", () => {
  assert.equal(
    nextDate(new Date("2024-01-31T12:00:00Z"), "MONTHLY").toISOString(),
    "2024-02-29T12:00:00.000Z",
  );
  assert.equal(
    nextDate(new Date("2024-02-29T12:00:00Z"), "YEARLY").toISOString(),
    "2025-02-28T12:00:00.000Z",
  );
});
test("invalid, negative, zero and excess precision amounts are rejected", () => {
  for (const amount of ["0", "-3", "1.001", "NaN", "1e5"])
    assert.equal(
      transactionSchema.safeParse({
        accountId: "a",
        kind: "EXPENSE",
        amount,
        description: "Test",
        date: new Date().toISOString(),
      }).success,
      false,
    );
});
test("spreadsheet formula injection is neutralized", () => {
  assert.equal(safeCell('=HYPERLINK("evil")'), '\'=HYPERLINK("evil")');
  assert.equal(safeCell("ordinary"), "ordinary");
});
