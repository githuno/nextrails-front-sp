"use client";

import { ToastProvider } from "@/hooks/useToast";
import { ErrorBoundaryProvider } from "@/hooks/useErrorBoundary";
import { StorageProvider } from "@/components/storage";
// import { ServiceWorkerProvider } from "@/hooks/useServiceWorker";

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <ErrorBoundaryProvider>
        <StorageProvider>
          {/* <ServiceWorkerProvider options={{ debug: true, immediate: false }}> */}
            {children}
          {/* </ServiceWorkerProvider> */}
        </StorageProvider>
      </ErrorBoundaryProvider>
    </ToastProvider>
  );
}
