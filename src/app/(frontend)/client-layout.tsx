"use client";

import { Inter } from "next/font/google";
import "./globals.css";

import { ToastProvider } from "@/hooks/useToast";
import { ErrorBoundaryProvider } from "@/hooks/useErrorBoundary";
import { StorageProvider } from "@/components/storage";

const inter = Inter({ subsets: ["latin"] });

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <ErrorBoundaryProvider>
      <body className={inter.className}>
        <StorageProvider>
        {process.env.NODE_ENV === "development" && (
          <script
            src="https://unpkg.com/react-scan/dist/auto.global.js"
            async
          />
        )}
        {children}
        </StorageProvider>
      </body>
      </ErrorBoundaryProvider>
    </ToastProvider>
  );
}
