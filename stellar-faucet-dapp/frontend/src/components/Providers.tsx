'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'react-hot-toast';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5000,
            gcTime: 10 * 60 * 1000,
            retry: 2,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'rgba(13,16,47,0.95)',
            color: '#e2e8f0',
            border: '1px solid rgba(52,97,245,0.3)',
            backdropFilter: 'blur(20px)',
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: '#07081a' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#07081a' },
          },
        }}
      />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
