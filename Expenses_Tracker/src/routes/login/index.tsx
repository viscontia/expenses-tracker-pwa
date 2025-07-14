import { useState, useEffect } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '~/stores/auth';
import { trpc } from '~/trpc/react';
import toast from 'react-hot-toast';


import type { inferProcedureOutput } from '@trpc/server';
import type { AppRouter } from '~/server/trpc/root';
import type { TRPCClientError } from '@trpc/client';
import type { UserPreferences } from '~/server/utils/auth';

const loginSchema = z.object({
  email: z.string().email('Indirizzo email non valido'),
  password: z.string().min(1, 'La password è obbligatoria'),
});

type LoginForm = z.infer<typeof loginSchema>;

export const Route = createFileRoute('/login/')({
  component: () => <LoginPage />,
});

function LoginPage() {

  
  const navigate = useNavigate();
  const { login: loginUser, rememberMe, setRememberMe, savedEmail } = useAuthStore();
  const utils = trpc.useContext();

  const mutation = trpc.auth.login.useMutation({
    onError: (error) => {
      console.error('tRPC onError callback:', error);
      
      let errorMessage = 'Si è verificato un errore durante l\'accesso.';
      
      if (error?.message?.includes('Invalid email or password')) {
        errorMessage = 'Email o password errati.';
      } else if (error?.message?.includes('User not found')) {
        errorMessage = 'Utente non trovato. Verifica l\'email o registrati.';
      }
      
      toast.error(errorMessage, {
        duration: 5000,
        position: 'top-right',
      });
    },
    onSuccess: (result) => {
      console.log('tRPC onSuccess callback:', result);
      
      loginUser(
        {
          ...result.user,
          preferences: result.user.preferences as UserPreferences | null,
        },
        result.token
      );
      void utils.auth.getCurrentUser.invalidate();
      void navigate({ to: '/dashboard' });
      toast.success('Accesso effettuato con successo!');
    }
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });
  
  useEffect(() => {
    if (rememberMe && savedEmail) {
      setValue('email', savedEmail);
    }
  }, [rememberMe, savedEmail, setValue]);

  const onSubmit = (data: LoginForm) => {
    // Usa mutation.mutate invece di mutateAsync per affidarci completamente ai callback
    mutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
          Accedi al tuo account
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
          Oppure{' '}
          <Link
            to="/register"
            className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
          >
            crea un nuovo account
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Indirizzo email
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  {...register('email')}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
              {errors.email && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Password
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  {...register('password')}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
              {errors.password && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="remember-me"
                  className="ml-2 block text-sm text-gray-900 dark:text-gray-300"
                >
                  Ricordami
                </label>
              </div>
            </div>

            <div>
                            <button
                type="submit"
                disabled={isSubmitting || mutation.isPending}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {isSubmitting || mutation.isPending ? 'Accesso in corso...' : 'Accedi'}
              </button>
            </div>

            <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-md">
              <div className="text-sm">
                <h3 className="font-medium text-green-800 dark:text-green-200 mb-2">Nuovo utente?</h3>
                <p className="text-green-700 dark:text-green-300 mb-2">
                  Se non hai ancora un account, puoi crearne uno rapidamente.
                </p>
                <Link
                  to="/register"
                  className="font-medium text-green-600 hover:text-green-500 dark:text-green-400 dark:hover:text-green-300"
                >
                  Registrati qui →
                </Link>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
