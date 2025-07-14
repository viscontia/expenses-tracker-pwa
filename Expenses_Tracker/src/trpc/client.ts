import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '~/server/trpc/root';
import SuperJSON from 'superjson';

function getBaseUrl() {
  if (typeof window !== 'undefined') return window.location.origin;
  return `http://localhost:3000`;
}

export const client = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: getBaseUrl() + '/trpc',
      transformer: SuperJSON,
      headers() {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
    }),
  ],
}); 