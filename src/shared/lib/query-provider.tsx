'use client';

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30s before data is considered stale
      gcTime: 5 * 60 * 1000, // 5min before inactive cache entries are garbage collected
      retry: 1,
      refetchOnWindowFocus: false, // prevents unexpected refetch when admin switches tabs
      refetchOnReconnect: true, // refreshes data after network recovery
    },
  },
});

export function ReactQueryProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* <ReactQueryDevtools initialIsOpen={false} /> */}
    </QueryClientProvider>
  );
}
