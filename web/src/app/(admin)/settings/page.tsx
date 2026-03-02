'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Save, Store } from 'lucide-react';

interface TenantSettings {
  id: string;
  name: string;
  slug: string;
  siret: string;
  address: string;
  vatNumber: string | null;
  phone: string | null;
  email: string;
  logoUrl: string | null;
}

export default function SettingsPage() {
  const { user } = useAuthStore();
  const isOwner = user?.role === 'OWNER';

  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [siret, setSiret] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get<TenantSettings>('/settings');
        setSettings(res);
        setName(res.name);
        setAddress(res.address);
        setSiret(res.siret);
        setVatNumber(res.vatNumber || '');
        setPhone(res.phone || '');
        setEmail(res.email);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSuccess(false);
    try {
      const res = await api.put<TenantSettings>('/settings', {
        name,
        address,
        siret,
        vatNumber: vatNumber || undefined,
        phone: phone || undefined,
        email,
      });
      setSettings(res);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-muted-foreground">Chargement...</p>;
  }

  if (!isOwner) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Seul le propriétaire peut accéder aux paramètres.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Paramètres du commerce</h1>
        <p className="text-sm text-muted-foreground">
          Sous-domaine : <span className="font-mono font-medium">{settings?.slug}.novacaisse.fr</span>
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            Informations du commerce
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="mb-1 block text-sm font-medium">Nom du commerce</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-10 w-full rounded-md border bg-card px-3 text-sm outline-none ring-primary focus:ring-2"
              />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-sm font-medium">Adresse complète</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="12 Rue de la Paix, 75001 Paris"
                className="h-10 w-full rounded-md border bg-card px-3 text-sm outline-none ring-primary focus:ring-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">SIRET</label>
              <input
                type="text"
                value={siret}
                onChange={(e) => setSiret(e.target.value)}
                maxLength={14}
                className="h-10 w-full rounded-md border bg-card px-3 text-sm outline-none ring-primary focus:ring-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">N° TVA intracommunautaire</label>
              <input
                type="text"
                value={vatNumber}
                onChange={(e) => setVatNumber(e.target.value)}
                placeholder="FR12345678901"
                className="h-10 w-full rounded-md border bg-card px-3 text-sm outline-none ring-primary focus:ring-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Téléphone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01 23 45 67 89"
                className="h-10 w-full rounded-md border bg-card px-3 text-sm outline-none ring-primary focus:ring-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 w-full rounded-md border bg-card px-3 text-sm outline-none ring-primary focus:ring-2"
              />
            </div>
          </div>

          <Separator />

          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving || !name || !address || !siret || !email}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Sauvegarde...' : 'Enregistrer'}
            </Button>
            {success && (
              <span className="text-sm font-medium text-green-600">
                Paramètres enregistrés
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
