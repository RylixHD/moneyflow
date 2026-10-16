import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Module,
} from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import type { NextFunction, Request, Response } from "express";
import { Db } from "./db";
import { AuthController, hash } from "./auth";
import { ApiController } from "./api";
import { Ledger } from "./ledger";
import { Jobs } from "./jobs";
@Catch()
class Errors implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (res.headersSent) return;
    const status =
      error instanceof ZodError
        ? 400
        : error instanceof HttpException
          ? error.getStatus()
          : error instanceof Prisma.PrismaClientKnownRequestError
            ? 409
            : 500;
    const message =
      error instanceof ZodError
        ? error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ")
        : error instanceof HttpException
          ? error.message
          : status === 409
            ? "Kayıt zaten var veya ilişkili kayıtlar nedeniyle işlem yapılamıyor."
            : "Sunucu hatası. Lütfen tekrar deneyin.";
    res.status(status).json({ message });
  }
}
@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 90 }])],
  controllers: [AuthController, ApiController],
  providers: [
    Db,
    Ledger,
    Jobs,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
class AppModule {}
async function bootstrap() {
  if (!process.env.APP_ORIGIN) throw new Error("APP_ORIGIN is required");
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn"],
  });
  app.use(helmet());
  app.use(cookieParser());
  app.useGlobalFilters(new Errors());
  app.enableShutdownHooks();
  const db = app.get(Db);
  app.use(
    "/api",
    async (
      req: Request & { userId?: string },
      res: Response,
      next: NextFunction,
    ) => {
      try {
        if (
          !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
          req.headers.origin !== process.env.APP_ORIGIN
        ) {
          res.status(403).json({ message: "Geçersiz istek kaynağı." });
          return;
        }
        if (req.path.startsWith("/auth/")) {
          next();
          return;
        }
        const raw = req.cookies.mf_session;
        if (!raw) {
          res.status(401).json({ message: "Giriş yapın." });
          return;
        }
        const session = await db.session.findUnique({
          where: { id: hash(raw) },
        });
        if (!session || session.expiresAt < new Date()) {
          res.status(401).json({ message: "Oturum süresi doldu." });
          return;
        }
        req.userId = session.userId;
        next();
      } catch {
        res.status(503).json({ message: "Veritabanına erişilemiyor." });
      }
    },
  );
  await app.listen(Number(process.env.API_PORT || 4000), "0.0.0.0");
}
bootstrap().catch(() => {
  console.error(
    "MoneyFlow API başlatılamadı. Veritabanı ve ortam ayarlarını kontrol edin.",
  );
  process.exit(1);
});
