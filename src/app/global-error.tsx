"use client";

import { useEffect } from "react";
import { useToast } from "@/hooks/toast";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { showError } = useToast();

  useEffect(() => {
    // Show error in toast
    showError(error);
  }, [error, showError]);

  return (
    <html>
      <body>
        {/* Simple button to try recovering from the error */}
        <button onClick={reset}>Try again</button>
      </body>
    </html>
  );
}
