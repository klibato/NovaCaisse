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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import type { Product, Category } from '@/types';

interface ProductForm {
  name: string;
  priceHt: string;
  categoryId: string;
  vatRateOnsite: string;
  vatRateTakeaway: string;
}

const EMPTY_FORM: ProductForm = {
  name: '',
  priceHt: '',
  categoryId: '',
  vatRateOnsite: '10',
  vatRateTakeaway: '5.5',
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [prods, cats] = await Promise.all([
        api.get<Product[]>('/products?includeInactive=true'),
        api.get<Category[]>('/categories'),
      ]);
      setProducts(prods);
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
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (product: Product) => {
    setForm({
      name: product.name,
      priceHt: centsToEuros(product.priceHt),
      categoryId: product.categoryId || '',
      vatRateOnsite: String(product.vatRateOnsite),
      vatRateTakeaway: String(product.vatRateTakeaway),
    });
    setEditingId(product.id);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const body = {
        name: form.name,
        priceHt: eurosToCents(parseFloat(form.priceHt)),
        categoryId: form.categoryId || null,
        vatRateOnsite: parseFloat(form.vatRateOnsite),
        vatRateTakeaway: parseFloat(form.vatRateTakeaway),
      };

      if (editingId) {
        await api.put(`/products/${editingId}`, body);
      } else {
        await api.post('/products', body);
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
    if (!confirm('Supprimer ce produit ?')) return;
    try {
      await api.delete(`/products/${id}`);
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
        <h1 className="text-2xl font-bold">Produits</h1>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Ajouter un produit
        </Button>
      </div>

      <div className="rounded-lg border bg-white">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                Nom
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                Catégorie
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                Prix HT
              </th>
              <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">
                TVA
              </th>
              <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">
                Statut
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium">{product.name}</td>
                <td className="px-4 py-3">
                  {product.category ? (
                    <Badge
                      style={{ backgroundColor: product.category.color }}
                      className="text-white"
                    >
                      {product.category.name}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {formatPrice(product.priceHt)}
                </td>
                <td className="px-4 py-3 text-center text-sm text-muted-foreground">
                  {Number(product.vatRateOnsite)}% / {Number(product.vatRateTakeaway)}%
                </td>
                <td className="px-4 py-3 text-center">
                  <Badge variant={product.active ? 'default' : 'secondary'}>
                    {product.active ? 'Actif' : 'Inactif'}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(product)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(product.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {products.length === 0 && (
          <p className="p-6 text-center text-muted-foreground">
            Aucun produit. Cliquez sur &quot;Ajouter&quot; pour commencer.
          </p>
        )}
      </div>

      {/* Product form dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Modifier le produit' : 'Nouveau produit'}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Modifiez les informations du produit.'
                : 'Remplissez les informations du nouveau produit.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nom</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Tacos Classique"
              />
            </div>
            <div>
              <Label htmlFor="price">Prix HT (euros)</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                value={form.priceHt}
                onChange={(e) => setForm({ ...form, priceHt: e.target.value })}
                placeholder="7.50"
              />
            </div>
            <div>
              <Label>Catégorie</Label>
              <Select
                value={form.categoryId}
                onValueChange={(val) =>
                  setForm({ ...form, categoryId: val === 'none' ? '' : val })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Aucune catégorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="vatOnsite">TVA sur place (%)</Label>
                <Input
                  id="vatOnsite"
                  type="number"
                  step="0.1"
                  value={form.vatRateOnsite}
                  onChange={(e) =>
                    setForm({ ...form, vatRateOnsite: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="vatTakeaway">TVA emporter (%)</Label>
                <Input
                  id="vatTakeaway"
                  type="number"
                  step="0.1"
                  value={form.vatRateTakeaway}
                  onChange={(e) =>
                    setForm({ ...form, vatRateTakeaway: e.target.value })
                  }
                />
              </div>
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
