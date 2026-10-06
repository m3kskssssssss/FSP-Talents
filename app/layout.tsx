import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { golos, jetbrains } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ФСП Таланты — обратный подбор ИТ-специалистов", template: "%s · ФСП Таланты" },
  description:
    "Кандидаты проходят адаптивный тест и получают категорию, работодатели находят их по категории и приглашают с вилкой зарплаты.",
  icons: { icon: "/brand/logo_02w.svg" },
};

export const viewport: Viewport = { themeColor: "#402FFF", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${golos.variable} ${jetbrains.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:bg-violet focus:px-4 focus:py-2 focus:text-white">
          К содержанию
        </a>
        <Header />
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
          {children}
        </main>
        <Footer />
        <Analytics />
      </body>
    </html>
  );
}
