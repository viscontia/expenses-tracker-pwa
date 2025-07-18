import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/settings/')({ 
  beforeLoad: () => {
    // Reindirizza alla dashboard, ora Settings è una modale
    throw redirect({ to: '/dashboard' });
  },
  component: () => null
});