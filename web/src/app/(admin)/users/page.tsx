'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Plus, Pencil, Key, Trash2 } from 'lucide-react';

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Propriétaire',
  MANAGER: 'Manager',
  CASHIER: 'Caissier',
};

const ROLE_COLORS: Record<string, string> = {
  OWNER: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  MANAGER: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  CASHIER: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

interface UserItem {
  id: string;
  name: string;
  email: string | null;
  role: 'OWNER' | 'MANAGER' | 'CASHIER';
  active: boolean;
  createdAt: string;
}

export default function UsersPage() {
  const { user: currentUser } = useAuthStore();
  const isOwner = currentUser?.role === 'OWNER';

  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createPin, setCreatePin] = useState('');
  const [createRole, setCreateRole] = useState<'OWNER' | 'MANAGER' | 'CASHIER'>('CASHIER');
  const [createEmail, setCreateEmail] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  // Edit modal
  const [editUser, setEditUser] = useState<UserItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<'OWNER' | 'MANAGER' | 'CASHIER'>('CASHIER');
  const [editLoading, setEditLoading] = useState(false);

  // Change PIN modal
  const [pinUser, setPinUser] = useState<UserItem | null>(null);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<UserItem[]>('/users');
      setUsers(res);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreate = async () => {
    setCreateLoading(true);
    setCreateError('');
    try {
      await api.post('/users', {
        name: createName,
        pinCode: createPin,
        role: createRole,
        email: createEmail || undefined,
      });
      setShowCreate(false);
      setCreateName('');
      setCreatePin('');
      setCreateRole('CASHIER');
      setCreateEmail('');
      await fetchUsers();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!editUser) return;
    setEditLoading(true);
    try {
      await api.put(`/users/${editUser.id}`, {
        name: editName,
        email: editEmail || undefined,
        role: editRole,
      });
      setEditUser(null);
      await fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setEditLoading(false);
    }
  };

  const handleChangePin = async () => {
    if (!pinUser) return;
    if (newPin !== confirmPin) {
      setPinError('Les PINs ne correspondent pas');
      return;
    }
    setPinLoading(true);
    setPinError('');
    try {
      await api.patch(`/users/${pinUser.id}/pin`, { newPin });
      setPinUser(null);
      setNewPin('');
      setConfirmPin('');
    } catch (err) {
      setPinError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setPinLoading(false);
    }
  };

  const handleToggle = async (u: UserItem) => {
    try {
      await api.patch(`/users/${u.id}/toggle`, {});
      await fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const handleDelete = async (u: UserItem) => {
    if (!window.confirm(`Supprimer définitivement ${u.name} ?`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      await fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const openEdit = (u: UserItem) => {
    setEditUser(u);
    setEditName(u.name);
    setEditEmail(u.email || '');
    setEditRole(u.role);
  };

  const availableRoles = isOwner
    ? (['OWNER', 'MANAGER', 'CASHIER'] as const)
    : (['CASHIER'] as const);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Utilisateurs</h1>
        <Button onClick={() => { setShowCreate(true); setCreateError(''); }}>
          <Plus className="mr-2 h-4 w-4" />
          Ajouter un utilisateur
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Chargement...</p>
      ) : users.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Aucun utilisateur</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <Card key={u.id} className={`${!u.active ? 'opacity-50' : ''}`}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="font-medium">{u.name}</p>
                    {u.email && <p className="text-xs text-muted-foreground">{u.email}</p>}
                  </div>
                  <Badge className={ROLE_COLORS[u.role]}>
                    {ROLE_LABELS[u.role]}
                  </Badge>
                  {!u.active && (
                    <Badge variant="outline" className="border-destructive text-destructive">
                      Inactif
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={u.active}
                    onCheckedChange={() => handleToggle(u)}
                    disabled={u.id === currentUser?.id}
                  />
                  <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setPinUser(u); setNewPin(''); setConfirmPin(''); setPinError(''); }}>
                    <Key className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(u)}
                    disabled={u.id === currentUser?.id}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create User Modal */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ajouter un utilisateur</DialogTitle>
            <DialogDescription>
              Créez un nouvel utilisateur pour votre commerce.
            </DialogDescription>
          </DialogHeader>
          {createError && (
            <p className="rounded-md bg-destructive/10 p-2 text-center text-sm text-destructive">
              {createError}
            </p>
          )}
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Nom</label>
              <input
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Jean Dupont"
                className="h-10 w-full rounded-md border bg-card px-3 text-sm outline-none ring-primary focus:ring-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">PIN (4-6 chiffres)</label>
              <input
                type="password"
                inputMode="numeric"
                value={createPin}
                onChange={(e) => setCreatePin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="1234"
                maxLength={6}
                className="h-10 w-full rounded-md border bg-card px-3 text-sm outline-none ring-primary focus:ring-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Rôle</label>
              <select
                value={createRole}
                onChange={(e) => setCreateRole(e.target.value as 'OWNER' | 'MANAGER' | 'CASHIER')}
                className="h-10 w-full rounded-md border bg-card px-3 text-sm outline-none ring-primary focus:ring-2"
              >
                {availableRoles.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Email (optionnel)</label>
              <input
                type="email"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                placeholder="jean@exemple.fr"
                className="h-10 w-full rounded-md border bg-card px-3 text-sm outline-none ring-primary focus:ring-2"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowCreate(false)}>
                Annuler
              </Button>
              <Button
                className="flex-1"
                onClick={handleCreate}
                disabled={createLoading || !createName || createPin.length < 4}
              >
                {createLoading ? 'Création...' : 'Créer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      {editUser && (
        <Dialog open onOpenChange={() => setEditUser(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Modifier {editUser.name}</DialogTitle>
              <DialogDescription>Modifiez les informations de l&apos;utilisateur.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Nom</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-10 w-full rounded-md border bg-card px-3 text-sm outline-none ring-primary focus:ring-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Email</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="h-10 w-full rounded-md border bg-card px-3 text-sm outline-none ring-primary focus:ring-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Rôle</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as 'OWNER' | 'MANAGER' | 'CASHIER')}
                  className="h-10 w-full rounded-md border bg-card px-3 text-sm outline-none ring-primary focus:ring-2"
                >
                  {availableRoles.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setEditUser(null)}>
                  Annuler
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleEdit}
                  disabled={editLoading || !editName}
                >
                  {editLoading ? 'Sauvegarde...' : 'Enregistrer'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Change PIN Modal */}
      {pinUser && (
        <Dialog open onOpenChange={() => setPinUser(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Changer le PIN de {pinUser.name}</DialogTitle>
              <DialogDescription>Entrez le nouveau PIN (4-6 chiffres).</DialogDescription>
            </DialogHeader>
            {pinError && (
              <p className="rounded-md bg-destructive/10 p-2 text-center text-sm text-destructive">
                {pinError}
              </p>
            )}
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Nouveau PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  className="h-10 w-full rounded-md border bg-card px-3 text-sm outline-none ring-primary focus:ring-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Confirmer le PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  className="h-10 w-full rounded-md border bg-card px-3 text-sm outline-none ring-primary focus:ring-2"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setPinUser(null)}>
                  Annuler
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleChangePin}
                  disabled={pinLoading || newPin.length < 4 || confirmPin.length < 4}
                >
                  {pinLoading ? 'Changement...' : 'Changer le PIN'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
