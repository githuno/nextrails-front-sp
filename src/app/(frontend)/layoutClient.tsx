"use client";

import { ToastProvider } from "@/hooks/useToast";
import { ErrorBoundaryProvider } from "@/hooks/useErrorBoundary";
import { StorageProvider } from "@/components/storage";
import { WorkerServiceProvider } from "@/hooks/useWorkerService";

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <ErrorBoundaryProvider>
        <StorageProvider>
          <WorkerServiceProvider options={{ debug: true, immediate: false }}>
            {children}
          </WorkerServiceProvider>
        </StorageProvider>
      </ErrorBoundaryProvider>
    </ToastProvider>
  );
}
