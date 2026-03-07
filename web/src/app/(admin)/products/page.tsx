'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { formatPrice, eurosToCents, centsToEuros, ttcToHt } from '@/lib/utils';
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
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Trash2, X, Eye, EyeOff, ChevronUp, ChevronDown } from 'lucide-react';
import type { Product, Category, Supplement } from '@/types';

interface SupplementForm {
  name: string;
  priceTtc: string;
  maxQty: string;
}

interface OptionChoiceForm {
  name: string;
  priceTtc: string;
}

interface OptionGroupForm {
  name: string;
  required: boolean;
  multiple: boolean;
  maxChoices: string;
  choices: OptionChoiceForm[];
}

interface ProductForm {
  name: string;
  priceTtc: string;
  categoryId: string;
  vatRate: string;
  supplements: SupplementForm[];
  optionGroups: OptionGroupForm[];
}

const EMPTY_SUPPLEMENT: SupplementForm = { name: '', priceTtc: '0', maxQty: '1' };

const EMPTY_FORM: ProductForm = {
  name: '',
  priceTtc: '',
  categoryId: '',
  vatRate: '10',
  supplements: [],
  optionGroups: [],
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
    const vatRate = Number(product.vatRate);

    const supplements: SupplementForm[] = (product.supplements ?? []).map((s) => ({
      name: s.name,
      priceTtc: centsToEuros((s as { priceTtc?: number }).priceTtc ?? Math.round(s.priceHt * (1 + vatRate / 100))),
      maxQty: String(s.maxQty),
    }));

    const optionGroups: OptionGroupForm[] = (product.optionGroups ?? []).map((g) => ({
      name: g.name,
      required: g.required,
      multiple: g.multiple,
      maxChoices: String(g.maxChoices),
      choices: g.choices.map((c) => ({
        name: c.name,
        priceTtc: centsToEuros(c.priceTtc),
      })),
    }));

    setForm({
      name: product.name,
      priceTtc: centsToEuros(product.priceTtc),
      categoryId: product.categoryId || '',
      vatRate: String(vatRate),
      supplements,
      optionGroups,
    });
    setEditingId(product.id);
    setShowForm(true);
  };

  const addSupplement = () => {
    setForm({ ...form, supplements: [...form.supplements, { ...EMPTY_SUPPLEMENT }] });
  };

  const updateSupplement = (index: number, field: 'name' | 'priceTtc' | 'maxQty', value: string) => {
    const updated = form.supplements.map((s, i) =>
      i === index ? { ...s, [field]: value } : s,
    );
    setForm({ ...form, supplements: updated });
  };

  const removeSupplement = (index: number) => {
    setForm({ ...form, supplements: form.supplements.filter((_, i) => i !== index) });
  };

  // ─── Option Groups helpers ───
  const addOptionGroup = () => {
    setForm({
      ...form,
      optionGroups: [
        ...form.optionGroups,
        { name: '', required: true, multiple: false, maxChoices: '1', choices: [{ name: '', priceTtc: '0' }] },
      ],
    });
  };

  const removeOptionGroup = (index: number) => {
    setForm({ ...form, optionGroups: form.optionGroups.filter((_, i) => i !== index) });
  };

  const updateOptionGroup = (index: number, field: string, value: string | boolean) => {
    const updated = form.optionGroups.map((g, i) =>
      i === index ? { ...g, [field]: value } : g,
    );
    setForm({ ...form, optionGroups: updated });
  };

  const moveOptionGroup = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= form.optionGroups.length) return;
    const groups = [...form.optionGroups];
    [groups[index], groups[target]] = [groups[target], groups[index]];
    setForm({ ...form, optionGroups: groups });
  };

  const addChoice = (groupIndex: number) => {
    const groups = form.optionGroups.map((g, i) =>
      i === groupIndex ? { ...g, choices: [...g.choices, { name: '', priceTtc: '0' }] } : g,
    );
    setForm({ ...form, optionGroups: groups });
  };

  const removeChoice = (groupIndex: number, choiceIndex: number) => {
    const groups = form.optionGroups.map((g, i) =>
      i === groupIndex
        ? { ...g, choices: g.choices.filter((_, ci) => ci !== choiceIndex) }
        : g,
    );
    setForm({ ...form, optionGroups: groups });
  };

  const updateChoice = (groupIndex: number, choiceIndex: number, field: 'name' | 'priceTtc', value: string) => {
    const groups = form.optionGroups.map((g, gi) =>
      gi === groupIndex
        ? {
            ...g,
            choices: g.choices.map((c, ci) =>
              ci === choiceIndex ? { ...c, [field]: value } : c,
            ),
          }
        : g,
    );
    setForm({ ...form, optionGroups: groups });
  };

  const moveChoice = (groupIndex: number, choiceIndex: number, direction: -1 | 1) => {
    const target = choiceIndex + direction;
    const group = form.optionGroups[groupIndex];
    if (target < 0 || target >= group.choices.length) return;
    const choices = [...group.choices];
    [choices[choiceIndex], choices[target]] = [choices[target], choices[choiceIndex]];
    const groups = form.optionGroups.map((g, i) =>
      i === groupIndex ? { ...g, choices } : g,
    );
    setForm({ ...form, optionGroups: groups });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const vatRate = parseFloat(form.vatRate);

      const supplements = form.supplements.length > 0
        ? form.supplements
            .filter((s) => s.name.trim() !== '')
            .map((s) => ({
              name: s.name.trim(),
              priceTtc: eurosToCents(parseFloat(s.priceTtc) || 0),
              maxQty: Math.max(1, parseInt(s.maxQty, 10) || 1),
            }))
        : null;

      const optionGroups = form.optionGroups.length > 0
        ? form.optionGroups
            .filter((g) => g.name.trim() !== '')
            .map((g, gi) => ({
              name: g.name.trim(),
              required: g.required,
              multiple: g.multiple,
              maxChoices: Math.max(1, parseInt(g.maxChoices, 10) || 1),
              position: gi,
              choices: g.choices
                .filter((c) => c.name.trim() !== '')
                .map((c, ci) => ({
                  name: c.name.trim(),
                  priceTtc: eurosToCents(parseFloat(c.priceTtc) || 0),
                  position: ci,
                })),
            }))
        : null;

      const body = {
        name: form.name,
        priceTtc: eurosToCents(parseFloat(form.priceTtc)),
        categoryId: form.categoryId || null,
        vatRate,
        supplements,
        optionGroups,
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

  const handleDelete = async (product: Product) => {
    if (!confirm(`Supprimer définitivement ${product.name} ?`)) return;
    try {
      await api.delete(`/products/${product.id}`);
      await fetchData();
    } catch (err) {
      console.error('Erreur suppression:', err);
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await api.patch(`/products/${id}/toggle`, {});
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
        <h1 className="text-2xl font-bold">Produits</h1>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Ajouter un produit
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
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
                Prix TTC
              </th>
              <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">
                TVA
              </th>
              <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">
                Suppl.
              </th>
              <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">
                Options
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
                  {formatPrice(product.priceTtc)}
                </td>
                <td className="px-4 py-3 text-center text-sm text-muted-foreground">
                  {Number(product.vatRate)}%
                </td>
                <td className="px-4 py-3 text-center">
                  {product.supplements && product.supplements.length > 0 ? (
                    <Badge variant="outline" className="text-xs">
                      {product.supplements.length}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {product.optionGroups && product.optionGroups.length > 0 ? (
                    <Badge variant="outline" className="text-xs">
                      {product.optionGroups.length}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleToggle(product.id)}
                    className="cursor-pointer"
                    title={product.active ? 'Désactiver' : 'Activer'}
                  >
                    <Badge variant={product.active ? 'default' : 'secondary'} className="gap-1">
                      {product.active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      {product.active ? 'Actif' : 'Inactif'}
                    </Badge>
                  </button>
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
                      onClick={() => handleDelete(product)}
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
        <DialogContent className="max-h-[90vh] overflow-y-auto">
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
              <Label htmlFor="price">Prix TTC (€)</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                value={form.priceTtc}
                onChange={(e) => setForm({ ...form, priceTtc: e.target.value })}
                placeholder="9.00"
              />
              {form.priceTtc && parseFloat(form.priceTtc) > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  HT calculé : {centsToEuros(ttcToHt(eurosToCents(parseFloat(form.priceTtc)), parseFloat(form.vatRate)))} €
                </p>
              )}
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
            <div>
              <Label>Taux TVA</Label>
              <Select
                value={form.vatRate}
                onValueChange={(val) => setForm({ ...form, vatRate: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Taux TVA" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5.5">5,5% — Produits conservables (canettes, bouteilles scellées)</SelectItem>
                  <SelectItem value="10">10% — Consommation immédiate (plats, boissons servies)</SelectItem>
                  <SelectItem value="20">20% — Boissons alcoolisées</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Supplements section */}
            <Separator />
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label>Suppléments</Label>
                <Button type="button" variant="outline" size="sm" onClick={addSupplement}>
                  <Plus className="mr-1 h-3 w-3" />
                  Ajouter
                </Button>
              </div>

              {form.supplements.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Aucun supplément. Ajoutez-en pour proposer des options en caisse.
                </p>
              )}

              <div className="space-y-2">
                {form.supplements.map((sup, i) => (
                  <div key={i} className="flex items-end gap-2 rounded-lg border p-3">
                    <div className="flex-1">
                      <Label className="text-xs">Nom</Label>
                      <Input
                        value={sup.name}
                        onChange={(e) => updateSupplement(i, 'name', e.target.value)}
                        placeholder="Fromage"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="w-24">
                      <Label className="text-xs">Prix TTC</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={sup.priceTtc}
                        onChange={(e) => updateSupplement(i, 'priceTtc', e.target.value)}
                        placeholder="0.00"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="w-16">
                      <Label className="text-xs">Max</Label>
                      <Input
                        type="number"
                        min="1"
                        value={sup.maxQty}
                        onChange={(e) => updateSupplement(i, 'maxQty', e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                      onClick={() => removeSupplement(i)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Option Groups section */}
            <Separator />
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label>Options de personnalisation</Label>
                <Button type="button" variant="outline" size="sm" onClick={addOptionGroup}>
                  <Plus className="mr-1 h-3 w-3" />
                  Ajouter un groupe
                </Button>
              </div>

              {form.optionGroups.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Aucune option. Ajoutez des groupes (viande, sauce, etc.) pour personnaliser le produit.
                </p>
              )}

              <div className="space-y-4">
                {form.optionGroups.map((group, gi) => (
                  <div key={gi} className="rounded-lg border p-3 space-y-3">
                    {/* Group header */}
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <Label className="text-xs">Nom du groupe</Label>
                        <Input
                          value={group.name}
                          onChange={(e) => updateOptionGroup(gi, 'name', e.target.value)}
                          placeholder="Viande, Sauce..."
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => moveOptionGroup(gi, -1)}
                          disabled={gi === 0}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => moveOptionGroup(gi, 1)}
                          disabled={gi === form.optionGroups.length - 1}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => removeOptionGroup(gi)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Group settings */}
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={group.required}
                          onCheckedChange={(val) => updateOptionGroup(gi, 'required', val)}
                        />
                        <span>Obligatoire</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={group.multiple}
                          onCheckedChange={(val) => updateOptionGroup(gi, 'multiple', val)}
                        />
                        <span>Choix multiple</span>
                      </div>
                      {group.multiple && (
                        <div className="flex items-center gap-1">
                          <Label className="text-xs">Max choix</Label>
                          <Input
                            type="number"
                            min="1"
                            value={group.maxChoices}
                            onChange={(e) => updateOptionGroup(gi, 'maxChoices', e.target.value)}
                            className="h-7 w-16 text-xs"
                          />
                        </div>
                      )}
                    </div>

                    {/* Choices */}
                    <div className="space-y-1.5">
                      {group.choices.map((choice, ci) => (
                        <div key={ci} className="flex items-end gap-2">
                          <div className="flex-1">
                            <Input
                              value={choice.name}
                              onChange={(e) => updateChoice(gi, ci, 'name', e.target.value)}
                              placeholder="Poulet, Bœuf..."
                              className="h-7 text-xs"
                            />
                          </div>
                          <div className="w-20">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={choice.priceTtc}
                              onChange={(e) => updateChoice(gi, ci, 'priceTtc', e.target.value)}
                              placeholder="0.00"
                              className="h-7 text-xs"
                            />
                          </div>
                          <div className="flex items-center gap-0.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => moveChoice(gi, ci, -1)}
                              disabled={ci === 0}
                            >
                              <ChevronUp className="h-3 w-3" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => moveChoice(gi, ci, 1)}
                              disabled={ci === group.choices.length - 1}
                            >
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => removeChoice(gi, ci)}
                              disabled={group.choices.length <= 1}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => addChoice(gi)}
                      >
                        <Plus className="mr-1 h-3 w-3" />
                        Ajouter un choix
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Annuler
              </Button>
              <Button onClick={handleSubmit} disabled={submitting || !form.name || !form.priceTtc}>
                {submitting ? 'Enregistrement...' : editingId ? 'Modifier' : 'Créer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
