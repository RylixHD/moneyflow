import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
  BadRequestException,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { randomBytes, createHash } from "node:crypto";
import * as argon2 from "argon2";
import nodemailer from "nodemailer";
import { z } from "zod";
import { Throttle } from "@nestjs/throttler";
import { Db } from "./db";
import { authSchema } from "./validation";
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const token = () => randomBytes(32).toString("hex");
export type AuthRequest = Request & { userId: string };
export async function sendMail(email: string, kind: string, raw: string) {
  if (!process.env.SMTP_HOST)
    throw new ServiceUnavailableException(
      "E-posta servisi yapılandırılmalı: SMTP_HOST.",
    );
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_PORT === "465",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });
  await transport.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: `MoneyFlow ${kind === "verify" ? "e-posta doğrulama" : "şifre sıfırlama"}`,
    text: `${process.env.APP_ORIGIN}/${kind}?token=${raw}`,
  });
}
@Controller("api/auth")
export class AuthController {
  constructor(@Inject(Db) private readonly db: Db) {}
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("register")
  async register(@Body() body: unknown) {
    const data = authSchema
      .extend({ name: z.string().trim().min(1).max(100) })
      .parse(body);
    if (!process.env.SMTP_HOST)
      throw new ServiceUnavailableException(
        "Kayıt için SMTP e-posta servisini yapılandırın.",
      );
    const passwordHash = await argon2.hash(data.password, {
      type: argon2.argon2id,
    });
    const user = await this.db.user.create({
      data: {
        email: data.email,
        name: data.name,
        passwordHash,
        settings: { create: {} },
        categories: {
          create: [
            "Market",
            "Yemek",
            "Ulaşım",
            "Eğitim",
            "Eğlence",
            "Sağlık",
            "Kira",
            "Faturalar",
            "Alışveriş",
            "Maaş",
            "Freelance",
            "Diğer",
          ].map((name) => ({ name })),
        },
      },
    });
    const raw = token();
    await this.db.authToken.create({
      data: {
        id: hash(raw),
        userId: user.id,
        kind: "verify",
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    try {
      await sendMail(user.email, "verify", raw);
    } catch {
      throw new ServiceUnavailableException(
        "Hesap oluşturuldu ancak e-posta gönderilemedi. E-posta servisini kontrol edip doğrulama mesajını yeniden isteyin.",
      );
    }
    return { message: "Doğrulama bağlantısı e-posta adresinize gönderildi." };
  }
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post("login")
  async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = authSchema.parse(body),
      user = await this.db.user.findUnique({ where: { email: data.email } });
    if (!user || !(await argon2.verify(user.passwordHash, data.password)))
      throw new UnauthorizedException("E-posta veya şifre hatalı.");
    if (!user.verified)
      throw new UnauthorizedException("Önce e-posta adresinizi doğrulayın.");
    const raw = token();
    await this.db.session.create({
      data: {
        id: hash(raw),
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });
    res.cookie("mf_session", raw, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 7 * 86400000,
    });
    return { ok: true };
  }
  @Post("logout") async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (req.cookies.mf_session)
      await this.db.session.deleteMany({
        where: { id: hash(req.cookies.mf_session) },
      });
    res.clearCookie("mf_session", { path: "/" });
    return { ok: true };
  }
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("request-token")
  async requestToken(@Body() body: unknown) {
    const data = z
      .object({
        email: z.email().transform((v) => v.toLowerCase()),
        kind: z.enum(["verify", "reset"]),
      })
      .parse(body);
    if (!process.env.SMTP_HOST)
      throw new ServiceUnavailableException("SMTP servisi yapılandırılmamış.");
    const user = await this.db.user.findUnique({
      where: { email: data.email },
    });
    if (user) {
      const raw = token();
      await this.db.$transaction([
        this.db.authToken.deleteMany({
          where: { userId: user.id, kind: data.kind },
        }),
        this.db.authToken.create({
          data: {
            id: hash(raw),
            userId: user.id,
            kind: data.kind,
            expiresAt: new Date(Date.now() + 3600000),
          },
        }),
      ]);
      await sendMail(user.email, data.kind, raw);
    }
    return { message: "Adres kayıtlıysa e-posta gönderildi." };
  }
  @Post("consume-token") async consume(@Body() body: unknown) {
    const data = z
      .object({
        token: z.string().length(64),
        kind: z.enum(["verify", "reset"]),
        password: z.string().min(12).max(128).optional(),
      })
      .parse(body);
    if (data.kind === "reset" && !data.password)
      throw new BadRequestException("Yeni şifre gerekli.");
    const passwordHash = data.password
      ? await argon2.hash(data.password)
      : undefined;
    await this.db.$transaction(async (tx) => {
      const record = await tx.authToken.findUnique({
        where: { id: hash(data.token) },
      });
      if (!record || record.kind !== data.kind || record.expiresAt < new Date())
        throw new BadRequestException("Bağlantı geçersiz veya süresi dolmuş.");
      await tx.authToken.delete({ where: { id: record.id } });
      await tx.user.update({
        where: { id: record.userId },
        data: data.kind === "verify" ? { verified: true } : { passwordHash },
      });
      if (data.kind === "reset")
        await tx.session.deleteMany({ where: { userId: record.userId } });
    });
    return { message: "İşlem tamamlandı. Giriş yapabilirsiniz." };
  }
  @Get("me") async me(@Req() req: Request) {
    const session = req.cookies.mf_session
      ? await this.db.session.findUnique({
          where: { id: hash(req.cookies.mf_session) },
          include: {
            user: {
              select: { id: true, name: true, email: true, settings: true },
            },
          },
        })
      : null;
    if (!session || session.expiresAt < new Date())
      throw new UnauthorizedException();
    return session.user;
  }
}
