'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { formatPrice, eurosToCents, centsToEuros } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import type { Menu, Product } from '@/types';

interface MenuForm {
  name: string;
  priceHt: string;
}

const EMPTY_FORM: MenuForm = {
  name: '',
  priceHt: '',
};

export default function MenusPage() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MenuForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [m, p] = await Promise.all([
        api.get<Menu[]>('/menus?includeInactive=true'),
        api.get<Product[]>('/products'),
      ]);
      setMenus(m);
      setProducts(p);
    } catch (err) {
      console.error('Erreur chargement:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (menu: Menu) => {
    setForm({
      name: menu.name,
      priceHt: centsToEuros(menu.priceHt),
    });
    setEditingId(menu.id);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const body = {
        name: form.name,
        priceHt: eurosToCents(parseFloat(form.priceHt)),
      };

      if (editingId) {
        await api.put(`/menus/${editingId}`, body);
      } else {
        await api.post('/menus', body);
      }

      setShowForm(false);
      await fetchData();
    } catch (err) {
      console.error('Erreur sauvegarde:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce menu ?')) return;
    try {
      await api.delete(`/menus/${id}`);
      await fetchData();
    } catch (err) {
      console.error('Erreur suppression:', err);
    }
  };

  if (loading) {
    return <p className="text-muted-foreground">Chargement...</p>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Menus</h1>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Ajouter un menu
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {menus.map((menu) => (
          <div
            key={menu.id}
            className="rounded-lg border bg-white p-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold">{menu.name}</h3>
                <p className="text-xl font-bold text-primary">
                  {formatPrice(menu.priceHt)} HT
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => openEdit(menu)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(menu.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {menu.items.length > 0 && (
              <div className="mt-3 space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Composition :
                </p>
                {menu.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 text-sm">
                    <span>{item.product.name}</span>
                    {item.isChoice && item.choiceGroup && (
                      <Badge variant="outline" className="text-xs">
                        Choix: {item.choiceGroup}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {menus.length === 0 && (
        <p className="mt-6 text-center text-muted-foreground">
          Aucun menu. Cliquez sur &quot;Ajouter&quot; pour commencer.
        </p>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Modifier le menu' : 'Nouveau menu'}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Modifiez les informations du menu.'
                : 'Remplissez les informations du nouveau menu.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="menuName">Nom</Label>
              <Input
                id="menuName"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Menu Tacos"
              />
            </div>
            <div>
              <Label htmlFor="menuPrice">Prix HT (euros)</Label>
              <Input
                id="menuPrice"
                type="number"
                step="0.01"
                min="0"
                value={form.priceHt}
                onChange={(e) => setForm({ ...form, priceHt: e.target.value })}
                placeholder="10.50"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Annuler
              </Button>
              <Button onClick={handleSubmit} disabled={submitting || !form.name || !form.priceHt}>
                {submitting ? 'Enregistrement...' : editingId ? 'Modifier' : 'Créer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
