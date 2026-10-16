import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./mobile.css";
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#0c0e14",
};
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
