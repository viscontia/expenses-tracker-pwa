import { create } from 'zustand';
import { client } from '~/trpc/client';
import type { User, UserPreferences } from '~/server/utils/auth';

const REMEMBER_ME_KEY = 'remember-me';
const SAVED_EMAIL_KEY = 'saved-email';
const THEME_KEY = 'theme';

type AuthState = {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  rememberMe: boolean;
  savedEmail: string | null;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  setUser: (user: User | null) => void;
  setRememberMe: (remember: boolean) => void;
  login: (user: User, token: string) => void;
  logout: () => void;
  checkAuth: () => void;
  updateUserPreferences: (prefs: Partial<UserPreferences>) => void;
};

const getInitialTheme = (): 'light' | 'dark' => {
  if (typeof window !== 'undefined') {
    const savedTheme = localStorage.getItem(THEME_KEY) as 'light' | 'dark';
    if (savedTheme) {
      document.documentElement.classList.add(savedTheme);
      return savedTheme;
    }
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.classList.add(systemTheme);
    return systemTheme;
  }
  return 'light';
};

const getInitialRememberMe = (): boolean => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(REMEMBER_ME_KEY) === 'true';
}

export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    token: typeof window !== 'undefined' ? localStorage.getItem('token') : null,
    isAuthenticated: false,
    isLoading: true,
    rememberMe: getInitialRememberMe(),
    savedEmail: typeof window !== 'undefined' ? localStorage.getItem(SAVED_EMAIL_KEY) : null,
    theme: getInitialTheme(),
    setTheme: (theme) => {
      set({ theme });
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(theme);
      localStorage.setItem(THEME_KEY, theme);
      if (get().isAuthenticated) {
        get().updateUserPreferences({ theme });
      }
    },
    setUser: (user) => {
      set({ user, isAuthenticated: !!user });
      if (user && user.preferences?.theme) {
        get().setTheme(user.preferences.theme as 'light' | 'dark');
      }
    },
    setRememberMe: (remember) => {
      set({ rememberMe: remember });
      localStorage.setItem(REMEMBER_ME_KEY, String(remember));
      if (!remember) {
        localStorage.removeItem(SAVED_EMAIL_KEY);
        set({ savedEmail: null });
      }
    },
    login: (user, token) => {
      localStorage.setItem('token', token);
      set({ user, token, isAuthenticated: true });
      if (get().rememberMe) {
        localStorage.setItem(SAVED_EMAIL_KEY, user.email);
        set({ savedEmail: user.email });
      }
      if (user.preferences?.theme) {
        get().setTheme(user.preferences.theme as 'light' | 'dark');
      }
    },
    logout: () => {
      const theme = get().theme;
      localStorage.clear();
      localStorage.setItem(THEME_KEY, theme);

      if (get().rememberMe) {
          const savedEmail = get().savedEmail;
          if (savedEmail) {
              localStorage.setItem(SAVED_EMAIL_KEY, savedEmail);
          }
      }
      
      set({ user: null, isAuthenticated: false, token: null });
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    },
    checkAuth: async () => {
      try {
        const token = get().token;
        if (!token) {
          get().setUser(null);
          set({ isLoading: false });
          return;
        }
        
        const me = await client.auth.getCurrentUser.query();
        get().setUser(me as User | null);
      } catch (error: any) {
        // Se il token è invalido o l'utente non esiste, rimuoviamo il token
        if (error?.data?.code === 'UNAUTHORIZED') {
          localStorage.removeItem('token');
          set({ token: null });
        }
        get().setUser(null);
      } finally {
        set({ isLoading: false });
      }
    },
    updateUserPreferences: async (prefs) => {
      try {
        await client.auth.updatePreferences.mutate(prefs);
      } catch (error) {
        console.error("Failed to update preferences:", error);
      }
    },
}));

useAuthStore.getState().checkAuth();
