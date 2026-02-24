const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface ApiError {
  error: string;
  code?: string;
}

class ApiClient {
  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem('auth-storage');
    if (!stored) return null;
    try {
      const parsed = JSON.parse(stored);
      return parsed.state?.token || null;
    } catch {
      return null;
    }
  }

  private getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem('auth-storage');
    if (!stored) return null;
    try {
      const parsed = JSON.parse(stored);
      return parsed.state?.refreshToken || null;
    } catch {
      return null;
    }
  }

  private async refreshAuth(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return false;

    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) return false;

      const data = await res.json();
      const stored = localStorage.getItem('auth-storage');
      if (stored) {
        const parsed = JSON.parse(stored);
        parsed.state.token = data.token;
        parsed.state.refreshToken = data.refreshToken;
        localStorage.setItem('auth-storage', JSON.stringify(parsed));
      }
      return true;
    } catch {
      return false;
    }
  }

  async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });

    if (res.status === 401 && token) {
      const refreshed = await this.refreshAuth();
      if (refreshed) {
        const newToken = this.getToken();
        headers['Authorization'] = `Bearer ${newToken}`;
        res = await fetch(`${API_URL}${path}`, {
          ...options,
          headers,
        });
      } else {
        localStorage.removeItem('auth-storage');
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        throw new Error('Session expirée');
      }
    }

    if (!res.ok) {
      const error: ApiError = await res.json().catch(() => ({
        error: `Erreur ${res.status}`,
      }));
      throw new Error(error.error || `Erreur ${res.status}`);
    }

    return res.json();
  }

  get<T>(path: string) {
    return this.fetch<T>(path, { method: 'GET' });
  }

  post<T>(path: string, body: unknown) {
    return this.fetch<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  put<T>(path: string, body: unknown) {
    return this.fetch<T>(path, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  delete<T>(path: string) {
    return this.fetch<T>(path, { method: 'DELETE' });
  }
}

export const api = new ApiClient();
