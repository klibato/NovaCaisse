'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Delete } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function LoginPage() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [tenantName, setTenantName] = useState<string | null>(null);
  const { login, isLoading } = useAuthStore();
  const router = useRouter();

  // Fetch tenant name from slug (subdomain)
  useEffect(() => {
    const match = document.cookie.match(/(?:^|; )tenant-slug=([^;]*)/);
    if (match) {
      const slug = decodeURIComponent(match[1]);
      fetch(`${API_URL}/tenants/by-slug/${slug}`)
        .then((res) => res.ok ? res.json() : null)
        .then((data) => {
          if (data?.name) setTenantName(data.name);
        })
        .catch(() => {});
    }
  }, []);

  const handleDigit = (digit: string) => {
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      setError('');

      if (newPin.length === 4) {
        handleLogin(newPin);
      }
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setError('');
  };

  const handleClear = () => {
    setPin('');
    setError('');
  };

  const handleLogin = async (pinCode: string) => {
    try {
      await login(pinCode);
      router.push('/');
    } catch {
      setPin('');
      setError('PIN incorrect');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 dark:from-background dark:to-background">
      <div className="w-full max-w-sm rounded-2xl bg-card p-8 shadow-xl">
        <div className="mb-8 text-center">
          {tenantName && (
            <p className="mb-1 text-lg font-semibold text-primary">{tenantName}</p>
          )}
          <h1 className="text-3xl font-bold text-foreground">NovaCaisse</h1>
          <p className="mt-2 text-muted-foreground">Entrez votre PIN</p>
        </div>

        <div className="mb-6 flex justify-center gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-4 w-4 rounded-full border-2 transition-all ${
                i < pin.length
                  ? 'border-primary bg-primary'
                  : 'border-muted-foreground/30'
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="mb-4 text-center text-sm font-medium text-destructive">
            {error}
          </p>
        )}

        <div className="grid grid-cols-3 gap-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <Button
              key={digit}
              variant="outline"
              size="xl"
              className="h-16 text-2xl font-semibold"
              onClick={() => handleDigit(digit)}
              disabled={isLoading}
            >
              {digit}
            </Button>
          ))}
          <Button
            variant="ghost"
            size="xl"
            className="h-16 text-sm"
            onClick={handleClear}
            disabled={isLoading}
          >
            Effacer
          </Button>
          <Button
            variant="outline"
            size="xl"
            className="h-16 text-2xl font-semibold"
            onClick={() => handleDigit('0')}
            disabled={isLoading}
          >
            0
          </Button>
          <Button
            variant="ghost"
            size="xl"
            className="h-16"
            onClick={handleDelete}
            disabled={isLoading}
          >
            <Delete className="h-6 w-6" />
          </Button>
        </div>

        {isLoading && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Connexion...
          </p>
        )}
      </div>
    </div>
  );
}
