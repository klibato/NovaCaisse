'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
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
import { Plus, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import type { Category } from '@/types';

interface CategoryForm {
  name: string;
  color: string;
  position: string;
}

const EMPTY_FORM: CategoryForm = {
  name: '',
  color: '#3498db',
  position: '0',
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const cats = await api.get<Category[]>('/categories?includeInactive=true');
      setCategories(cats);
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
    setForm({ ...EMPTY_FORM, position: String(categories.length) });
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (cat: Category) => {
    setForm({
      name: cat.name,
      color: cat.color,
      position: String(cat.position),
    });
    setEditingId(cat.id);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const body = {
        name: form.name,
        color: form.color,
        position: parseInt(form.position, 10),
      };

      if (editingId) {
        await api.put(`/categories/${editingId}`, body);
      } else {
        await api.post('/categories', body);
      }

      setShowForm(false);
      await fetchData();
    } catch (err) {
      console.error('Erreur sauvegarde:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (cat: Category) => {
    if (!confirm(`Supprimer définitivement ${cat.name} ?`)) return;
    try {
      await api.delete(`/categories/${cat.id}`);
      await fetchData();
    } catch (err) {
      console.error('Erreur suppression:', err);
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await api.patch(`/categories/${id}/toggle`, {});
      await fetchData();
    } catch (err) {
      console.error('Erreur toggle:', err);
    }
  };

  if (loading) {
    return <p className="text-muted-foreground">Chargement...</p>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Catégories</h1>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Ajouter une catégorie
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className="flex items-center justify-between rounded-lg border bg-card p-4"
          >
            <div className="flex items-center gap-3">
              <div
                className="h-10 w-10 rounded-lg"
                style={{ backgroundColor: cat.color }}
              />
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{cat.name}</p>
                  <button
                    onClick={() => handleToggle(cat.id)}
                    className="cursor-pointer"
                    title={cat.active ? 'Désactiver' : 'Activer'}
                  >
                    <Badge variant={cat.active ? 'default' : 'secondary'} className="gap-1 text-xs">
                      {cat.active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      {cat.active ? 'Actif' : 'Inactif'}
                    </Badge>
                  </button>
                </div>
                <p className="text-sm text-muted-foreground">
                  {cat._count.products} produit{cat._count.products !== 1 ? 's' : ''} — position {cat.position}
                </p>
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => openEdit(cat)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => handleDelete(cat)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {categories.length === 0 && (
        <p className="mt-6 text-center text-muted-foreground">
          Aucune catégorie. Cliquez sur &quot;Ajouter&quot; pour commencer.
        </p>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Modifiez les informations de la catégorie.'
                : 'Remplissez les informations de la nouvelle catégorie.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="catName">Nom</Label>
              <Input
                id="catName"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Burgers"
              />
            </div>
            <div>
              <Label htmlFor="catColor">Couleur</Label>
              <div className="flex items-center gap-3">
                <input
                  id="catColor"
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="h-10 w-16 cursor-pointer rounded border"
                />
                <Badge style={{ backgroundColor: form.color }} className="text-white">
                  {form.name || 'Aperçu'}
                </Badge>
              </div>
            </div>
            <div>
              <Label htmlFor="catPos">Position</Label>
              <Input
                id="catPos"
                type="number"
                min="0"
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Annuler
              </Button>
              <Button onClick={handleSubmit} disabled={submitting || !form.name}>
                {submitting ? 'Enregistrement...' : editingId ? 'Modifier' : 'Créer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
