'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  AreaChart, Area, CartesianGrid,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Receipt, ShoppingCart, Euro,
} from 'lucide-react';

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Espèces',
  card: 'CB',
  meal_voucher: 'Ticket Resto',
  check: 'Chèque',
};

const PIE_COLORS = ['#16a34a', '#2563eb', '#f59e0b', '#ef4444'];

const PERIODS = [
  { key: 'today', label: "Aujourd'hui" },
  { key: 'week', label: 'Cette semaine' },
  { key: 'month', label: 'Ce mois' },
  { key: 'year', label: 'Cette année' },
] as const;

interface DashboardStats {
  caHt: number;
  caTtc: number;
  nombreTickets: number;
  panierMoyen: number;
  topProduits: { name: string; qty: number }[];
  ventilationPaiements: { method: string; amount: number }[];
  comparaison: number;
  caParJour: { date: string; total: number }[];
}

function formatEuros(cents: number): string {
  return (cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

export default function DashboardPage() {
  const [period, setPeriod] = useState<string>('today');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async (p: string) => {
    setLoading(true);
    try {
      const data = await api.get<DashboardStats>(`/dashboard/stats?period=${p}`);
      setStats(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats(period);
  }, [period, fetchStats]);

  const caParJourData = (stats?.caParJour ?? []).map((d) => ({
    date: formatShortDate(d.date),
    total: d.total / 100,
  }));

  const topProduitsData = (stats?.topProduits ?? []).map((p) => ({
    name: p.name,
    qty: p.qty,
  }));

  const pieData = (stats?.ventilationPaiements ?? []).map((p) => ({
    name: PAYMENT_LABELS[p.method] ?? p.method,
    value: p.amount,
  }));

  const compIcon = (stats?.comparaison ?? 0) >= 0
    ? <TrendingUp className="h-4 w-4 text-green-600" />
    : <TrendingDown className="h-4 w-4 text-red-500" />;

  const compColor = (stats?.comparaison ?? 0) >= 0 ? 'text-green-600' : 'text-red-500';

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex gap-1 rounded-lg bg-secondary p-1">
          {PERIODS.map((p) => (
            <Button
              key={p.key}
              variant={period === p.key ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setPeriod(p.key)}
              className="text-xs"
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              CA TTC
            </CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {loading ? '--' : formatEuros(stats?.caTtc ?? 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tickets
            </CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {loading ? '--' : stats?.nombreTickets ?? 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Panier moyen
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {loading ? '--' : formatEuros(stats?.panierMoyen ?? 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              vs période préc.
            </CardTitle>
            {!loading && compIcon}
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${loading ? '' : compColor}`}>
              {loading ? '--' : `${(stats?.comparaison ?? 0) > 0 ? '+' : ''}${stats?.comparaison ?? 0}%`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        {/* CA par jour */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">CA par jour</CardTitle>
          </CardHeader>
          <CardContent>
            {caParJourData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={caParJourData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v}€`} />
                  <Tooltip formatter={(value: number) => [`${value.toFixed(2)} €`, 'CA TTC']} />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="#16a34a"
                    fill="#16a34a"
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
                Aucune donnée pour cette période
              </p>
            )}
          </CardContent>
        </Card>

        {/* Top 5 produits */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Top 5 produits</CardTitle>
          </CardHeader>
          <CardContent>
            {topProduitsData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={topProduitsData} layout="vertical" margin={{ left: 10 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip formatter={(value: number) => [`${value}`, 'Vendus']} />
                  <Bar dataKey="qty" fill="#2563eb" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
                Aucune donnée pour cette période
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Répartition paiements */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Répartition paiements</CardTitle>
        </CardHeader>
        <CardContent>
          {pieData.length > 0 ? (
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }: { name: string; percent: number }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {pieData.map((_, index) => (
                      <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [formatPrice(value), 'Montant']}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
              Aucune donnée pour cette période
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
