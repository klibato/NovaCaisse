'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { formatPrice, eurosToCents, centsToEuros } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Pencil, Trash2, Check, Eye, EyeOff } from 'lucide-react';
import type { Menu, Product } from '@/types';

interface MenuItemForm {
  productId: string;
  productName: string;
  priceHt: number;
  vatRate: number;
  isChoice: boolean;
  choiceGroup: string;
}

interface MenuForm {
  name: string;
  priceHt: string;
  items: MenuItemForm[];
}

const EMPTY_FORM: MenuForm = {
  name: '',
  priceHt: '',
  items: [],
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
      items: menu.items.map((mi) => ({
        productId: mi.productId,
        productName: mi.product.name,
        priceHt: mi.product.priceHt,
        vatRate: Number(mi.product.vatRate),
        isChoice: mi.isChoice,
        choiceGroup: mi.choiceGroup ?? '',
      })),
    });
    setEditingId(menu.id);
    setShowForm(true);
  };

  const toggleProduct = (product: Product) => {
    setForm((prev) => {
      const exists = prev.items.find((i) => i.productId === product.id);
      if (exists) {
        return { ...prev, items: prev.items.filter((i) => i.productId !== product.id) };
      }
      return {
        ...prev,
        items: [
          ...prev.items,
          {
            productId: product.id,
            productName: product.name,
            priceHt: product.priceHt,
            vatRate: Number(product.vatRate),
            isChoice: false,
            choiceGroup: '',
          },
        ],
      };
    });
  };

  const updateMenuItem = (productId: string, field: 'isChoice' | 'choiceGroup', value: boolean | string) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((i) =>
        i.productId === productId ? { ...i, [field]: value } : i
      ),
    }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const body = {
        name: form.name,
        priceHt: eurosToCents(parseFloat(form.priceHt)),
        items: form.items.map((item, idx) => ({
          productId: item.productId,
          isChoice: item.isChoice,
          choiceGroup: item.choiceGroup || null,
          position: idx,
        })),
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

  const handleDelete = async (menu: Menu) => {
    if (!confirm(`Supprimer définitivement ${menu.name} ?`)) return;
    try {
      await api.delete(`/menus/${menu.id}`);
      await fetchData();
    } catch (err) {
      console.error('Erreur suppression:', err);
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await api.patch(`/menus/${id}/toggle`, {});
      await fetchData();
    } catch (err) {
      console.error('Erreur toggle:', err);
    }
  };

  if (loading) {
    return <p className="text-muted-foreground">Chargement...</p>;
  }

  const groupItems = (menu: Menu) => {
    const fixed: typeof menu.items = [];
    const choiceGroups = new Map<string, typeof menu.items>();

    for (const item of menu.items) {
      if (item.isChoice && item.choiceGroup) {
        const group = choiceGroups.get(item.choiceGroup) ?? [];
        group.push(item);
        choiceGroups.set(item.choiceGroup, group);
      } else {
        fixed.push(item);
      }
    }
    return { fixed, choiceGroups };
  };

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
        {menus.map((menu) => {
          const { fixed, choiceGroups } = groupItems(menu);
          return (
            <div key={menu.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">{menu.name}</h3>
                    <button
                      onClick={() => handleToggle(menu.id)}
                      className="cursor-pointer"
                      title={menu.active ? 'Désactiver' : 'Activer'}
                    >
                      <Badge variant={menu.active ? 'default' : 'secondary'} className="gap-1 text-xs">
                        {menu.active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        {menu.active ? 'Actif' : 'Inactif'}
                      </Badge>
                    </button>
                  </div>
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
                    onClick={() => handleDelete(menu)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {menu.items.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <p className="text-sm font-medium text-muted-foreground">
                    Composition :
                  </p>
                  {fixed.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 text-sm">
                      <span className="text-foreground">{item.product.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({formatPrice(item.product.priceHt)} HT)
                      </span>
                    </div>
                  ))}
                  {Array.from(choiceGroups.entries()).map(([group, items]) => (
                    <div key={group} className="ml-2 rounded border-l-2 border-primary/30 pl-2">
                      <p className="text-xs font-semibold uppercase text-primary/70">
                        Choix {group} :
                      </p>
                      {items.map((item) => (
                        <div key={item.id} className="flex items-center gap-2 text-sm">
                          <span className="text-foreground">{item.product.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ({formatPrice(item.product.priceHt)} HT)
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {menus.length === 0 && (
        <p className="mt-6 text-center text-muted-foreground">
          Aucun menu. Cliquez sur &quot;Ajouter&quot; pour commencer.
        </p>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Modifier le menu' : 'Nouveau menu'}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Modifiez les informations et la composition du menu.'
                : 'Définissez le nom, le prix et la composition du menu.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
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
            </div>

            <Separator />

            <div>
              <Label className="mb-2 block text-base">Produits du menu</Label>
              <p className="mb-3 text-sm text-muted-foreground">
                Cochez les produits à inclure. Pour les choix (ex: boisson), activez &quot;Choix&quot; et indiquez le groupe.
              </p>
              <div className="max-h-[200px] space-y-1 overflow-y-auto rounded border p-2">
                {products.map((product) => {
                  const isSelected = form.items.some((i) => i.productId === product.id);
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => toggleProduct(product)}
                      className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                        isSelected
                          ? 'bg-primary/10 text-primary'
                          : 'hover:bg-secondary'
                      }`}
                    >
                      <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                        isSelected ? 'border-primary bg-primary text-white' : 'border-input'
                      }`}>
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                      <span className="flex-1 font-medium">{product.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatPrice(product.priceHt)} HT — TVA {Number(product.vatRate)}%
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {form.items.length > 0 && (
              <div>
                <Label className="mb-2 block text-base">Configuration des items</Label>
                <div className="space-y-3">
                  {form.items.map((item) => (
                    <div
                      key={item.productId}
                      className="flex items-center gap-4 rounded-lg border bg-card p-3"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{item.productName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatPrice(item.priceHt)} HT — TVA {item.vatRate}%
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={item.isChoice}
                          onCheckedChange={(v) => updateMenuItem(item.productId, 'isChoice', v)}
                        />
                        <Label className="text-xs whitespace-nowrap">Choix</Label>
                      </div>
                      {item.isChoice && (
                        <Input
                          value={item.choiceGroup}
                          onChange={(e) => updateMenuItem(item.productId, 'choiceGroup', e.target.value)}
                          placeholder="boisson"
                          className="w-32"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Annuler
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || !form.name || !form.priceHt || (!editingId && form.items.length === 0)}
              >
                {submitting ? 'Enregistrement...' : editingId ? 'Modifier' : 'Créer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
