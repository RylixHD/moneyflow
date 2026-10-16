import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";
import { randomUUID } from "node:crypto";
import { hash, token } from "../apps/api/src/auth";
const url = process.env.DATABASE_URL || "";
if (!new URL(url).pathname.includes("moneyflow_test"))
  throw new Error(
    "Integration tests require an isolated moneyflow_test database.",
  );
const db = new PrismaClient(),
  origin = "http://localhost:3000",
  base = "http://localhost:4011/api";
let child: ChildProcess,
  cookie = "",
  userId = "",
  otherId = "",
  account = "",
  otherAccount = "",
  category = "",
  goal = "";
const password = "test-only-password-123";
async function request(
  path: string,
  method = "GET",
  body?: unknown,
  headers: Record<string, string> = {},
) {
  const response = await fetch(base + "/" + path, {
    method,
    headers: {
      Origin: origin,
      Cookie: cookie,
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return response;
}
before(
  async () => {
    const passwordHash = await argon2.hash(password);
    const user = await db.user.create({
      data: {
        email: `test-${randomUUID()}@example.test`,
        name: "Integration Test",
        passwordHash,
        verified: true,
        settings: { create: {} },
        categories: { create: { name: "Test" } },
      },
      include: { categories: true },
    });
    userId = user.id;
    category = user.categories[0].id;
    const other = await db.user.create({
      data: {
        email: `other-${randomUUID()}@example.test`,
        name: "Other",
        passwordHash,
        verified: true,
      },
    });
    otherId = other.id;
    account = (
      await db.account.create({
        data: { userId, name: "Test TRY", currency: "TRY", opening: "1000" },
      })
    ).id;
    otherAccount = (
      await db.account.create({
        data: { userId: otherId, name: "Private", currency: "TRY" },
      })
    ).id;
    child = spawn(
      process.execPath,
      ["--import", "tsx", "apps/api/src/main.ts"],
      {
        env: {
          ...process.env,
          API_PORT: "4011",
          APP_ORIGIN: origin,
          NODE_ENV: "test",
        },
        stdio: "pipe",
      },
    );
    let logs = "";
    child.stderr?.on("data", (d) => {
      logs += d;
    });
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        await fetch(base + "/auth/me");
        ready = true;
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 200));
      }
    }
    if (!ready) throw new Error("API failed to start: " + logs);
    const login = await request("auth/login", "POST", {
      email: user.email,
      password,
    });
    assert.equal(login.status, 201);
    cookie = login.headers.get("set-cookie")!.split(";")[0];
  },
  { timeout: 40000 },
);
after(async () => {
  child?.kill();
  await db.transaction.deleteMany({
    where: { userId: { in: [userId, otherId] } },
  });
  await db.savingsContribution.deleteMany({ where: { userId } });
  await db.recurringTransaction.deleteMany({ where: { userId } });
  await db.budget.deleteMany({ where: { userId } });
  await db.user.deleteMany({ where: { id: { in: [userId, otherId] } } });
  await db.$disconnect();
});
test("origin protection rejects cross-site writes", async () => {
  const r = await request(
    "transactions",
    "POST",
    {},
    { Origin: "https://evil.example" },
  );
  assert.equal(r.status, 403);
});
test("unauthenticated reads are rejected", async () => {
  assert.equal(
    (await request("snapshot", "GET", undefined, { Cookie: "" })).status,
    401,
  );
});
test("cross-user account and transfer destination cannot be used", async () => {
  for (const body of [
    { accountId: otherAccount, kind: "EXPENSE" },
    { accountId: account, kind: "TRANSFER", destinationId: otherAccount },
  ]) {
    const r = await request("transactions", "POST", {
      ...body,
      description: "test",
      amount: "1.00",
      date: new Date().toISOString(),
    });
    assert.equal(r.status, 400);
  }
});
test("real CRUD and transfers preserve decimal balances without inflating totals", async () => {
  const data = {
    accountId: account,
    categoryId: category,
    kind: "INCOME",
    amount: "100.10",
    description: "Test income",
    date: new Date().toISOString(),
  };
  let r = await request("transactions", "POST", data);
  assert.equal(r.status, 201);
  const transaction = await r.json();
  r = await request(`transactions/${transaction.id}`, "PATCH", {
    ...data,
    amount: "100.20",
  });
  assert.equal(r.status, 200);
  const target = await db.account.create({
    data: { userId, name: "Target", currency: "TRY" },
  });
  r = await request("transactions", "POST", {
    ...data,
    kind: "TRANSFER",
    amount: "30.10",
    destinationId: target.id,
  });
  assert.equal(r.status, 201);
  const snap = await (await request("snapshot")).json();
  assert.equal(snap.totals.income, "100.20");
  assert.equal(snap.totals.balance, "1100.20");
  assert.equal(
    snap.accounts.find((a: any) => a.id === target.id).balance,
    "30.10",
  );
  assert.equal(
    (await request("transactions/delete", "POST", { ids: [transaction.id] }))
      .status,
    201,
  );
});
test("cross-currency transfer requires provenance and calculates received amount", async () => {
  const target = await db.account.create({
    data: { userId, name: "USD", currency: "USD" },
  });
  const data = {
    accountId: account,
    destinationId: target.id,
    kind: "TRANSFER",
    amount: "300.00",
    description: "FX",
    date: new Date().toISOString(),
  };
  assert.equal((await request("transactions", "POST", data)).status, 400);
  const r = await request("transactions", "POST", {
    ...data,
    fxRate: "0.03",
    fxSource: "Test fixture",
    fxDate: new Date().toISOString(),
  });
  assert.equal(r.status, 201);
  assert.equal((await r.json()).receivedAmount, "9");
  assert.equal(
    (
      await request(`resources/accounts/${target.id}`, "PATCH", {
        name: "USD",
        currency: "EUR",
        kind: "BANK",
        opening: "0",
      })
    ).status,
    400,
  );
});
test("budgets, savings and subscription data persist", async () => {
  let r = await request("resources/budgets", "POST", {
    categoryId: category,
    amount: "100",
    currency: "TRY",
    month: new Date().toISOString().slice(0, 7),
  });
  assert.equal(r.status, 201);
  r = await request("resources/goals", "POST", {
    name: "Goal",
    target: "500",
    currency: "TRY",
    deadline: new Date(Date.now() + 86400000).toISOString(),
  });
  assert.equal(r.status, 201);
  goal = (await r.json()).id;
  assert.equal(
    (await request(`goals/${goal}/contribute`, "POST", { amount: "20.15" }))
      .status,
    201,
  );
  r = await request("resources/subscriptions", "POST", {
    name: "Test subscription",
    amount: "9.99",
    currency: "TRY",
    period: "MONTHLY",
    nextPayment: new Date().toISOString(),
  });
  assert.equal(r.status, 201);
  const snap = await (await request("snapshot")).json();
  assert.equal(snap.goals[0].saved, "20.15");
  assert.ok(snap.notifications.length > 0);
});
test("CSV import is atomic when any row is invalid", async () => {
  const before = await db.transaction.count({ where: { userId } }),
    date = new Date().toISOString();
  const csv = `date,kind,description,amount,accountId\n${date},EXPENSE,Valid,1.00,${account}\n${date},EXPENSE,Invalid,-1,${account}`;
  assert.equal((await request("import", "POST", { csv })).status, 400);
  assert.equal(await db.transaction.count({ where: { userId } }), before);
});
test("export formats are real CSV, XLSX and PDF files", async () => {
  for (const [format, mime] of [
    ["csv", "text/csv"],
    ["xlsx", "spreadsheetml"],
    ["pdf", "application/pdf"],
  ]) {
    const r = await request(`export/${format}`);
    assert.equal(r.status, 200);
    assert.ok(r.headers.get("content-type")?.includes(mime));
    assert.ok((await r.arrayBuffer()).byteLength > 20);
  }
});
test("missing AI configuration gives an actionable error", async () => {
  const r = await request("ai", "POST", {
    question: "Summarize expenses",
    currency: "TRY",
    month: new Date().toISOString().slice(0, 7),
  });
  assert.equal(r.status, 503);
  assert.match((await r.json()).message, /OPENAI_API_KEY/);
});
test("cross-user edits and deletes never expose or change another owner data", async () => {
  assert.equal(
    (
      await request(`resources/accounts/${otherAccount}`, "PATCH", {
        name: "Hacked",
        currency: "TRY",
        kind: "BANK",
        opening: "1",
      })
    ).status,
    404,
  );
  await request(`resources/accounts/${otherAccount}`, "DELETE");
  assert.ok(await db.account.findUnique({ where: { id: otherAccount } }));
});
test("recurring catch-up is idempotent across concurrent requests", async () => {
  const rule = await db.recurringTransaction.create({
    data: {
      userId,
      accountId: account,
      description: "Recurring fixture",
      kind: "EXPENSE",
      amount: "3.33",
      period: "MONTHLY",
      nextDate: new Date(Date.now() - 86400000),
    },
  });
  const results = await Promise.all([
    request("snapshot"),
    request("snapshot"),
    request("snapshot"),
  ]);
  for (const r of results) assert.equal(r.status, 200);
  assert.equal(
    await db.transaction.count({
      where: { userId, recurringKey: { startsWith: rule.id } },
    }),
    1,
  );
});
test("range reports return server-computed totals and validate reversed ranges", async () => {
  const day = new Date().toISOString().slice(0, 10);
  const r = await request(`report?currency=TRY&from=${day}&to=${day}`);
  assert.equal(r.status, 200);
  assert.equal(typeof (await r.json()).net, "string");
  assert.equal(
    (await request("report?currency=TRY&from=2026-12-31&to=2026-01-01")).status,
    400,
  );
});
test("password reset token is single-use and revokes existing sessions", async () => {
  const raw = token();
  await db.authToken.create({
    data: {
      id: hash(raw),
      userId,
      kind: "reset",
      expiresAt: new Date(Date.now() + 60000),
    },
  });
  const data = {
    token: raw,
    kind: "reset",
    password: "new-test-password-2026",
  };
  assert.equal((await request("auth/consume-token", "POST", data)).status, 201);
  assert.equal((await request("auth/consume-token", "POST", data)).status, 400);
  assert.equal((await request("snapshot")).status, 401);
});
