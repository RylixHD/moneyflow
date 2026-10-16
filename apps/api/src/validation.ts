import { z } from "zod";
export const money = z
  .string()
  .regex(/^(0|[1-9]\d{0,11})(\.\d{1,2})?$/)
  .refine((v) => Number(v) > 0, "Tutar sıfırdan büyük olmalı");
export const currency = z.enum(["TRY", "USD", "EUR"]);
const name = z.string().trim().min(1).max(100);
const date = z.iso.datetime();
export const schemas = {
  accounts: z.object({
    name,
    kind: z.enum(["BANK", "CASH", "WALLET", "SAVINGS"]).default("BANK"),
    currency,
    opening: z
      .string()
      .regex(/^-?\d{1,12}(\.\d{1,2})?$/)
      .default("0"),
  }),
  categories: z.object({ name, icon: z.string().max(30).default("circle") }),
  budgets: z.object({
    categoryId: name,
    amount: money,
    currency,
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    rollover: z.boolean().default(true),
  }),
  goals: z.object({ name, target: money, currency, deadline: date }),
  subscriptions: z.object({
    name,
    amount: money,
    currency,
    period: z.enum(["MONTHLY", "YEARLY"]),
    nextPayment: date,
    active: z.boolean().default(true),
  }),
  recurring: z.object({
    accountId: name,
    description: name,
    amount: money,
    kind: z.enum(["INCOME", "EXPENSE"]),
    period: z.enum(["MONTHLY", "YEARLY"]),
    nextDate: date,
    active: z.boolean().default(true),
  }),
};
export const transactionSchema = z.object({
  accountId: name,
  destinationId: name.nullish(),
  categoryId: name.nullish(),
  kind: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  amount: money,
  description: name,
  date,
  tags: z.array(z.string().max(30)).max(10).default([]),
  receivedAmount: money.nullish(),
  fxRate: z
    .string()
    .regex(/^\d{1,10}(\.\d{1,8})?$/)
    .refine((v) => Number(v) > 0)
    .nullish(),
  fxSource: z.string().min(1).max(100).nullish(),
  fxDate: date.nullish(),
});
export const authSchema = z.object({
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(12).max(128),
  name: name.optional(),
});
