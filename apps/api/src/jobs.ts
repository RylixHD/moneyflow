import {
  Injectable,
  Inject,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { Db } from "./db";
import { Ledger } from "./ledger";
@Injectable()
export class Jobs implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  constructor(
    @Inject(Db) private db: Db,
    @Inject(Ledger) private ledger: Ledger,
  ) {}
  onModuleInit() {
    if (process.env.NODE_ENV === "test") return;
    this.timer = setInterval(
      () =>
        void this.run().catch(() =>
          console.error("Scheduled processing unavailable."),
        ),
      15 * 60 * 1000,
    );
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async run() {
    if (this.running) return;
    this.running = true;
    try {
      let cursor: string | undefined;
      for (;;) {
        const users = await this.db.user.findMany({
          take: 50,
          orderBy: { id: "asc" },
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          select: { id: true, settings: true },
        });
        if (!users.length) break;
        for (const user of users) {
          try {
            const now = new Date(),
              month = now.toISOString().slice(0, 7);
            for (const currency of ["TRY", "USD", "EUR"])
              await this.ledger.snapshot(user.id, currency, month);
            if (user.settings?.notifications) {
              const monday = new Date(now);
              monday.setUTCDate(now.getUTCDate() - ((now.getUTCDay() + 6) % 7));
              for (const [period, key, message] of [
                [
                  "weekly",
                  monday.toISOString().slice(0, 10),
                  "Haftalık finans özeti hazır. Raporlar bölümünden son 7 günü inceleyin.",
                ],
                [
                  "monthly",
                  month,
                  "Aylık finans raporunuz hazır. Raporlar bölümünden gelir, gider ve bütçelerinizi karşılaştırın.",
                ],
              ])
                await this.db.notification.upsert({
                  where: { key: `${user.id}:${period}:${key}` },
                  update: {},
                  create: {
                    userId: user.id,
                    key: `${user.id}:${period}:${key}`,
                    message,
                  },
                });
            }
          } catch {
            console.error(
              "Scheduled financial processing failed; retrying next cycle.",
            );
          }
        }
        cursor = users.at(-1)!.id;
      }
      await this.db.session.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      await this.db.authToken.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
    } finally {
      this.running = false;
    }
  }
}
