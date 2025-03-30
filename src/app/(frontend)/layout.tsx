import { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import ClientProviders from "./layoutClient";

export const metadata: Metadata = {
  title: "Worker Demo",
  description: "Web Worker and Service Worker Demo",
  icons: {
    icon: "/favicon.ico",
  },
};
const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        {process.env.NODE_ENV === "development" && (
          <Script 
            src="https://unpkg.com/react-scan/dist/auto.global.js" 
            strategy="afterInteractive"
          />
        )}
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}