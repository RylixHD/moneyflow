import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "MoneyFlow — Finansal hayatına yön ver",
  description:
    "Gelirlerini, bütçelerini ve birikim hedeflerini tek bir yerde yönet.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
