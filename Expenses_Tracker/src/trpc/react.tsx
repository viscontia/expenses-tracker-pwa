import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import {
  loggerLink,
  splitLink,
  httpBatchStreamLink,
  httpSubscriptionLink,
} from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import { useState } from 'react';
import SuperJSON from 'superjson';

import { type AppRouter } from '~/server/trpc/root';
import { getQueryClient } from './query-client';
import { useAuthStore } from '~/stores/auth';

export const trpc = createTRPCReact<AppRouter>();

function getBaseUrl() {
  if (typeof window !== 'undefined') return window.location.origin;
  return `http://localhost:3000`;
}

export function TRPCReactProvider(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        loggerLink({
          enabled: (op) =>
            process.env.NODE_ENV === 'development' ||
            (op.direction === 'down' && op.result instanceof Error),
        }),
        splitLink({
          condition: (op) => op.type === 'subscription',
          false: httpBatchStreamLink({
            transformer: SuperJSON,
            url: getBaseUrl() + '/trpc',
            headers() {
              const { token } = useAuthStore.getState();
              if (!token) {
                return {};
              }
              return {
                Authorization: `Bearer ${token}`,
              };
            },
          }),
          true: httpSubscriptionLink({
            transformer: SuperJSON,
            url: getBaseUrl() + '/trpc',
          }),
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {props.children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
