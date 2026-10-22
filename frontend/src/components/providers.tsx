"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "sonner";
import { ApiError } from "@/lib/api";
import { useTheme } from "@/lib/theme";

export function Providers({ children }: { children: React.ReactNode }) {
  // Mounted for the whole app so the theme follows the OS and other tabs even when no menu is open.
  const [theme] = useTheme();
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Do not retry client errors (401/403/404/422); retry network failures and 5xx twice.
            retry: (count, error) =>
              count < 2 && (!(error instanceof ApiError) || error.status === 0 || error.status >= 500),
            refetchOnWindowFocus: false,
            staleTime: 5_000,
          },
          mutations: { retry: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster position="bottom-right" richColors closeButton theme={theme} />
    </QueryClientProvider>
  );
}
