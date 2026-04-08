'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Loader2, AlertCircle, Mail, RefreshCw } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

interface FormData {
  name: string;
  slug: string;
  email: string;
  address: string;
  siret: string;
  phone: string;
  pinCode: string;
  pinConfirm: string;
  ownerName: string;
}

type SlugStatus = 'idle' | 'checking' | 'available' | 'taken' | 'reserved' | 'error';

export default function RegisterPage() {
  const [form, setForm] = useState<FormData>({
    name: '',
    slug: '',
    email: '',
    address: '',
    siret: '',
    phone: '',
    pinCode: '',
    pinConfirm: '',
    ownerName: '',
  });
  const [slugManual, setSlugManual] = useState(false);
  const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    email: string;
  } | null>(null);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  // Auto-generate slug from name
  useEffect(() => {
    if (!slugManual && form.name) {
      setForm((prev) => ({ ...prev, slug: slugify(prev.name) }));
    }
  }, [form.name, slugManual]);

  // Debounced slug check
  const checkSlug = useCallback(async (slug: string) => {
    if (slug.length < 3) {
      setSlugStatus('idle');
      return;
    }
    setSlugStatus('checking');
    try {
      const res = await fetch(
        `${API_URL}/tenants/check-slug?slug=${encodeURIComponent(slug)}`
      );
      if (!res.ok) {
        setSlugStatus('error');
        return;
      }
      const data = await res.json();
      setSlugStatus(data.available ? 'available' : 'taken');
    } catch {
      setSlugStatus('error');
    }
  }, []);

  useEffect(() => {
    if (!form.slug || form.slug.length < 3) {
      setSlugStatus('idle');
      return;
    }
    const timer = setTimeout(() => checkSlug(form.slug), 400);
    return () => clearTimeout(timer);
  }, [form.slug, checkSlug]);

  const updateField = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === 'slug') setSlugManual(true);
  };

  const validate = (): string | null => {
    if (!form.name.trim()) return 'Le nom du restaurant est requis.';
    if (form.slug.length < 3) return 'Le sous-domaine doit contenir au moins 3 caracteres.';
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(form.slug))
      return 'Le sous-domaine ne peut contenir que des lettres minuscules, chiffres et tirets.';
    if (!form.email.includes('@')) return 'Adresse email invalide.';
    if (form.address.length < 5) return 'L\'adresse est trop courte.';
    if (!/^[0-9]{14}$/.test(form.siret)) return 'Le SIRET doit contenir exactement 14 chiffres.';
    if (!/^[0-9]{4,6}$/.test(form.pinCode)) return 'Le code PIN doit contenir 4 a 6 chiffres.';
    if (form.pinCode !== form.pinConfirm) return 'Les codes PIN ne correspondent pas.';
    if (slugStatus === 'taken') return 'Ce sous-domaine est deja pris.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/tenants/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug,
          email: form.email,
          address: form.address,
          siret: form.siret,
          phone: form.phone || undefined,
          pinCode: form.pinCode,
          ownerName: form.ownerName || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `Erreur ${res.status}` }));
        setError(data.error || `Erreur ${res.status}`);
        return;
      }

      await res.json();
      setSuccess({
        email: form.email,
      });
    } catch {
      setError('Erreur de connexion au serveur. Veuillez reessayer.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setResendMessage(null);
    try {
      const res = await fetch(`${API_URL}/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: success?.email }),
      });
      if (res.ok) {
        setResendMessage('Email renvoye avec succes.');
      } else {
        setResendMessage('Erreur lors du renvoi. Reessayez plus tard.');
      }
    } catch {
      setResendMessage('Erreur de connexion au serveur.');
    } finally {
      setResending(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
            <Mail className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="mt-6 text-center text-2xl font-bold text-gray-900">
            Verifiez votre boite email
          </h1>
          <p className="mt-3 text-center text-gray-600">
            Un email de verification a ete envoye a
          </p>
          <p className="mt-1 text-center font-semibold text-gray-900">
            {success.email}
          </p>
          <p className="mt-4 text-center text-sm text-gray-500">
            Cliquez sur le lien dans l&apos;email pour activer votre compte.
          </p>
          <div className="mt-6 space-y-3">
            <button
              onClick={handleResend}
              disabled={resending}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
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
          <p className="mt-6 text-center text-xs text-gray-400">
            Vous n&apos;avez pas recu l&apos;email ? Verifiez vos spams.
          </p>
          <Link
            href="/"
            className="mt-4 flex w-full items-center justify-center text-sm text-gray-500 hover:text-gray-700"
          >
            Retour a l&apos;accueil
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4">
          <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-4 w-4" />
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-600 text-sm font-bold text-white">
                N
              </div>
              <span className="font-bold text-gray-900">NovaCaisse</span>
            </div>
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 py-12">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">
            Creer votre compte
          </h1>
          <p className="mt-2 text-gray-600">
            Inscrivez votre restaurant en quelques minutes.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {error && (
            <div className="flex items-start gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Restaurant info */}
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-gray-900">
              Informations du restaurant
            </legend>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Nom du restaurant *
              </label>
              <input
                id="name"
                type="text"
                required
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="Kebab du Coin"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              />
            </div>

            <div>
              <label htmlFor="slug" className="block text-sm font-medium text-gray-700">
                Sous-domaine *
              </label>
              <div className="mt-1 flex items-center">
                <input
                  id="slug"
                  type="text"
                  required
                  value={form.slug}
                  onChange={(e) => updateField('slug', e.target.value.toLowerCase())}
                  placeholder="kebab-du-coin"
                  className="block w-full rounded-l-lg border border-r-0 border-gray-300 px-3 py-2.5 text-gray-900 shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                />
                <span className="inline-flex items-center rounded-r-lg border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm text-gray-500">
                  .novacaisse.fr
                </span>
              </div>
              <div className="mt-1 h-5">
                {slugStatus === 'checking' && (
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Verification...
                  </span>
                )}
                {slugStatus === 'available' && (
                  <span className="flex items-center gap-1 text-xs text-green-600">
                    <Check className="h-3 w-3" />
                    Disponible
                  </span>
                )}
                {slugStatus === 'taken' && (
                  <span className="text-xs text-red-600">
                    Ce sous-domaine est deja pris.
                  </span>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email *
              </label>
              <input
                id="email"
                type="email"
                required
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="contact@kebab-du-coin.fr"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              />
            </div>

            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                Adresse *
              </label>
              <input
                id="address"
                type="text"
                required
                value={form.address}
                onChange={(e) => updateField('address', e.target.value)}
                placeholder="12 rue de la Paix, 75001 Paris"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="siret" className="block text-sm font-medium text-gray-700">
                  SIRET *
                </label>
                <input
                  id="siret"
                  type="text"
                  required
                  maxLength={14}
                  value={form.siret}
                  onChange={(e) =>
                    updateField('siret', e.target.value.replace(/\D/g, ''))
                  }
                  placeholder="12345678901234"
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                  Telephone
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  placeholder="01 23 45 67 89"
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>
            </div>
          </fieldset>

          {/* Owner info */}
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-gray-900">
              Compte proprietaire
            </legend>

            <div>
              <label htmlFor="ownerName" className="block text-sm font-medium text-gray-700">
                Votre nom
              </label>
              <input
                id="ownerName"
                type="text"
                value={form.ownerName}
                onChange={(e) => updateField('ownerName', e.target.value)}
                placeholder="Jean Dupont"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              />
            </div>

            <div>
              <label htmlFor="pinCode" className="block text-sm font-medium text-gray-700">
                Code PIN (4-6 chiffres) *
              </label>
              <input
                id="pinCode"
                type="password"
                required
                maxLength={6}
                value={form.pinCode}
                onChange={(e) =>
                  updateField('pinCode', e.target.value.replace(/\D/g, ''))
                }
                placeholder="••••"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                inputMode="numeric"
              />
            </div>

            <div>
              <label htmlFor="pinConfirm" className="block text-sm font-medium text-gray-700">
                Confirmer le code PIN *
              </label>
              <input
                id="pinConfirm"
                type="password"
                required
                maxLength={6}
                value={form.pinConfirm}
                onChange={(e) =>
                  updateField('pinConfirm', e.target.value.replace(/\D/g, ''))
                }
                placeholder="••••"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                inputMode="numeric"
              />
              {form.pinConfirm && form.pinCode !== form.pinConfirm && (
                <p className="mt-1 text-xs text-red-600">
                  Les codes PIN ne correspondent pas.
                </p>
              )}
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={submitting || slugStatus === 'taken'}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-3 font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Creation en cours...
              </>
            ) : (
              'Creer mon restaurant'
            )}
          </button>

          <p className="text-center text-sm text-gray-500">
            Vous avez deja un compte ?{' '}
            <Link href="/login" className="text-green-600 hover:text-green-700">
              Se connecter
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
