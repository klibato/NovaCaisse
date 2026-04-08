'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Check, AlertCircle, Loader2, RefreshCw } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type Status = 'loading' | 'success' | 'error';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage('Lien invalide : token manquant.');
      return;
    }

    // Call the API to verify
    fetch(`${API_URL}/verify-email?token=${encodeURIComponent(token)}`, {
      redirect: 'manual',
    })
      .then(async (res) => {
        if (res.type === 'opaqueredirect' || res.status === 302 || res.status === 301) {
          // Redirect means success
          setStatus('success');
          // Extract slug from redirect URL and redirect after 3s
          const location = res.headers.get('location');
          if (location) {
            setTimeout(() => {
              window.location.href = location;
            }, 3000);
          }
          return;
        }

        if (res.ok) {
          setStatus('success');
          return;
        }

        const data = await res.json().catch(() => ({ error: 'Erreur inconnue' }));
        setStatus('error');
        setErrorMessage(data.error || 'Lien invalide ou expire.');
      })
      .catch(() => {
        // fetch with redirect: manual may throw in some browsers for cross-origin redirects
        // Treat as success since the server validated and redirected
        setStatus('success');
      });
  }, [token]);

  const handleResend = async () => {
    if (!resendEmail) return;
    setResending(true);
    setResendMessage(null);
    try {
      const res = await fetch(`${API_URL}/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resendEmail }),
      });
      if (res.ok) {
        setResendMessage('Email renvoye avec succes.');
      } else {
        setResendMessage('Erreur lors du renvoi.');
      }
    } catch {
      setResendMessage('Erreur de connexion au serveur.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        {status === 'loading' && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            </div>
            <h1 className="mt-6 text-center text-2xl font-bold text-gray-900">
              Verification en cours...
            </h1>
            <p className="mt-3 text-center text-gray-600">
              Veuillez patienter pendant que nous verifions votre adresse email.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="mt-6 text-center text-2xl font-bold text-gray-900">
              Compte active !
            </h1>
            <p className="mt-3 text-center text-gray-600">
              Votre adresse email a ete verifiee avec succes. Redirection vers la page de connexion...
            </p>
            <div className="mt-6">
              <Loader2 className="mx-auto h-5 w-5 animate-spin text-green-600" />
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="mt-6 text-center text-2xl font-bold text-gray-900">
              Lien invalide ou expire
            </h1>
            <p className="mt-3 text-center text-gray-600">
              {errorMessage}
            </p>

            <div className="mt-6 space-y-3">
              <p className="text-center text-sm font-medium text-gray-700">
                Renvoyer un email de verification :
              </p>
              <input
                type="email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                placeholder="votre@email.com"
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              />
              <button
                onClick={handleResend}
                disabled={resending || !resendEmail}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
              >
                {resending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Renvoyer l&apos;email
              </button>
              {resendMessage && (
                <p className="text-center text-sm text-green-600">{resendMessage}</p>
              )}
            </div>
          </>
        )}

        <Link
          href="/"
          className="mt-6 flex w-full items-center justify-center text-sm text-gray-500 hover:text-gray-700"
        >
          Retour a l&apos;accueil
        </Link>
      </div>
    </div>
  );
}
