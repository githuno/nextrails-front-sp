"use client"

// import { DevDashboard, DevDashboardProvider } from "@/components/devDashboard"
import { Toaster } from "@/components/atoms/Toast"
import { StorageProvider } from "@/components/storage"
import { ErrorBoundaryProvider } from "@/hooks/useErrorBoundary"
import { ServiceWorkerProvider } from "@/hooks/useWorker"

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundaryProvider>
      <StorageProvider>
        <ServiceWorkerProvider options={{ debug: true, immediate: false }}>
          {children}
          <Toaster />
        </ServiceWorkerProvider>
      </StorageProvider>
    </ErrorBoundaryProvider>
  )
}
