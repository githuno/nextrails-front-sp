import { Metadata } from "next"
import { Inter } from "next/font/google"
import Script from "next/script"
import { ReactNode } from "react"
import "./globals.css"

export const metadata: Metadata = {
  title: "Worker Demo",
  description: "Web Worker and Service Worker Demo",
  icons: {
    icon: "/favicon.ico",
  },
}
const inter = Inter({ subsets: ["latin"] })

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <head>
        {process.env.NODE_ENV === "development" && (
          <Script
            src="//unpkg.com/react-scan/dist/auto.global.js"
            strategy="afterInteractive"
            crossOrigin="anonymous"
          />
        )}
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
