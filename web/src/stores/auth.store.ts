import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, AuthResponse } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (pinCode: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (pinCode: string) => {
        set({ isLoading: true, error: null });
        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          // Send tenant slug if available (from subdomain cookie)
          if (typeof document !== 'undefined') {
            const match = document.cookie.match(/(?:^|; )tenant-slug=([^;]*)/);
            if (match) {
              headers['X-Tenant-Slug'] = decodeURIComponent(match[1]);
            }
          }
          const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ pinCode }),
          });

          if (!res.ok) {
            const data = await res.json().catch(() => ({ error: 'Erreur de connexion' }));
            throw new Error(data.error || 'PIN incorrect');
          }

          const data: AuthResponse = await res.json();
          set({
            user: data.user,
            token: data.token,
            refreshToken: data.refreshToken,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (err) {
          set({
            isLoading: false,
            error: err instanceof Error ? err.message : 'Erreur de connexion',
          });
          throw err;
        }
      },

      logout: () => {
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          error: null,
        });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
