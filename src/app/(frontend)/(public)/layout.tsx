"use client"

// import { DevDashboard, DevDashboardProvider } from "@/components/devDashboard"
import { StorageProvider } from "@/components/storage"
import { ErrorBoundaryProvider } from "@/hooks/useErrorBoundary"
// import { ToastProvider } from "@/hooks/useToast"
import { ServiceWorkerProvider } from "@/hooks/useWorker"

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    // <DevDashboardProvider>
    //   <DevDashboard />
    // <ToastProvider>
    <ErrorBoundaryProvider>
      <StorageProvider>
        <ServiceWorkerProvider options={{ debug: true, immediate: false }}>{children}</ServiceWorkerProvider>
      </StorageProvider>
    </ErrorBoundaryProvider>
    // </ToastProvider>
    // </DevDashboardProvider>
  )
}
