"use client";

import { Inter } from "next/font/google";
import "./globals.css";
import { StorageProvider } from "@/components/storage";
import { useToast } from "@/hooks/toast";

const inter = Inter({ subsets: ["latin"] });

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { ToastPortal } = useToast();

  return (
    <body className={inter.className}>
      <StorageProvider>
        {process.env.NODE_ENV === "development" && (
          <script
            src="https://unpkg.com/react-scan/dist/auto.global.js"
            async
          />
        )}
        {children}
        <ToastPortal />
      </StorageProvider>
    </body>
  );
}
