'use client';

import Link from 'next/link';
import {
  Monitor,
  Building2,
  ShieldCheck,
  WifiOff,
  Printer,
  BarChart3,
  ChevronRight,
  Check,
} from 'lucide-react';

const features = [
  {
    icon: Monitor,
    title: 'Caisse tactile',
    description:
      'Interface optimisee pour tablette et smartphone. Gros boutons, couleurs, ajout rapide des produits.',
  },
  {
    icon: Building2,
    title: 'Multi-restaurant',
    description:
      'Gerez plusieurs points de vente depuis un seul compte. Chaque restaurant a son propre sous-domaine.',
  },
  {
    icon: ShieldCheck,
    title: 'Conforme NF525 / ISCA',
    description:
      'Chainage SHA-256, signature HMAC, clotures Z automatiques. Conforme a la loi Finances 2026.',
  },
  {
    icon: WifiOff,
    title: 'Mode offline',
    description:
      'Continuez a encaisser meme sans connexion internet. Les tickets se synchronisent automatiquement.',
  },
  {
    icon: Printer,
    title: 'Impression thermique',
    description:
      'Ticket client et ticket cuisine. Compatible avec les imprimantes ESC/POS du marche.',
  },
  {
    icon: BarChart3,
    title: 'Dashboard temps reel',
    description:
      'Chiffre d\'affaires, top produits, repartition des paiements. Tout en un coup d\'oeil.',
  },
];

const pricingFeatures = [
  'Caisse enregistreuse complete',
  'Conforme ISCA / NF525',
  'Mode offline',
  'Impression tickets',
  'Dashboard & statistiques',
  'Multi-utilisateurs (PIN)',
  'Mises a jour incluses',
  'Support par email',
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-600 font-bold text-white">
              N
            </div>
            <span className="text-xl font-bold text-gray-900">NovaCaisse</span>
          </div>
          <nav className="hidden items-center gap-6 md:flex">
            <a href="#features" className="text-sm text-gray-600 hover:text-gray-900">
              Fonctionnalites
            </a>
            <a href="#pricing" className="text-sm text-gray-600 hover:text-gray-900">
              Tarifs
            </a>
            <a href="#hosting" className="text-sm text-gray-600 hover:text-gray-900">
              Securite
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/register"
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700"
            >
              Essayer gratuitement
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Connexion
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-green-50 to-white py-20 lg:py-32">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-4 py-1.5 text-sm text-green-700">
            <ShieldCheck className="h-4 w-4" />
            Conforme loi Finances 2026
          </div>
          <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight text-gray-900 lg:text-6xl">
            La caisse enregistreuse{' '}
            <span className="text-green-600">nouvelle generation</span> pour les
            restaurants
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600 lg:text-xl">
            Fast food, kebab, tacos, burger, pizzeria — NovaCaisse est la
            solution de caisse la plus simple et la plus abordable du marche.
            Installez-la sur n&apos;importe quelle tablette.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/register"
              className="flex items-center gap-2 rounded-xl bg-green-600 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-green-200 transition hover:bg-green-700"
            >
              Demarrer maintenant
              <ChevronRight className="h-5 w-5" />
            </Link>
            <a
              href="#features"
              className="flex items-center gap-2 rounded-xl border border-gray-300 px-8 py-4 text-lg font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Decouvrir les fonctionnalites
            </a>
          </div>
          {/* Screenshot placeholder */}
          <div className="mx-auto mt-16 max-w-4xl overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 shadow-2xl">
            <div className="flex h-8 items-center gap-2 border-b border-gray-200 bg-gray-50 px-4">
              <div className="h-3 w-3 rounded-full bg-red-400" />
              <div className="h-3 w-3 rounded-full bg-yellow-400" />
              <div className="h-3 w-3 rounded-full bg-green-400" />
              <span className="ml-2 text-xs text-gray-400">
                demo.novacaisse.fr
              </span>
            </div>
            <div className="flex min-h-[300px] items-center justify-center bg-gradient-to-br from-green-50 to-green-100 p-8 lg:min-h-[400px]">
              <div className="grid w-full max-w-2xl grid-cols-3 gap-4">
                {['Kebab Classique', 'Tacos XL', 'Burger Maison', 'Pizza Margherita', 'Frites', 'Boisson'].map(
                  (item) => (
                    <div
                      key={item}
                      className="flex h-20 items-center justify-center rounded-xl bg-white p-3 text-center text-sm font-medium text-gray-700 shadow-sm"
                    >
                      {item}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 lg:text-4xl">
              Tout ce qu&apos;il faut pour encaisser
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-gray-600">
              NovaCaisse est concu pour les fast foods. Pas de fonctionnalites
              inutiles, juste l&apos;essentiel pour encaisser vite et bien.
            </p>
          </div>
          <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-gray-100 p-6 transition hover:border-green-200 hover:shadow-lg"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 text-green-600">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm text-gray-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-gray-50 py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 lg:text-4xl">
              Un prix simple, sans surprise
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-gray-600">
              Pas d&apos;engagement, pas de frais caches. Annulez quand vous
              voulez.
            </p>
          </div>
          <div className="mx-auto mt-12 max-w-md">
            <div className="overflow-hidden rounded-2xl border border-green-200 bg-white shadow-xl">
              <div className="bg-green-600 p-6 text-center text-white">
                <p className="text-sm font-medium uppercase tracking-wide opacity-90">
                  Forfait unique
                </p>
                <div className="mt-2 flex items-baseline justify-center gap-1">
                  <span className="text-5xl font-extrabold">29</span>
                  <span className="text-2xl font-medium">&euro;/mois</span>
                </div>
                <p className="mt-2 text-sm opacity-80">HT par point de vente</p>
              </div>
              <div className="p-6">
                <ul className="space-y-3">
                  {pricingFeatures.map((feature) => (
                    <li key={feature} className="flex items-center gap-3 text-sm text-gray-700">
                      <Check className="h-5 w-5 shrink-0 text-green-600" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-3 text-center font-semibold text-white transition hover:bg-green-700"
                >
                  Commencer maintenant
                  <ChevronRight className="h-5 w-5" />
                </Link>
                <p className="mt-3 text-center text-xs text-gray-500">
                  14 jours d&apos;essai gratuit. Sans carte bancaire.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Hosting in France */}
      <section id="hosting" className="py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-3xl">
              <span role="img" aria-label="Drapeau France">
                {/* French flag using CSS */}
                <span className="flex h-10 w-14 overflow-hidden rounded-sm">
                  <span className="h-full w-1/3 bg-blue-700" />
                  <span className="h-full w-1/3 bg-white" />
                  <span className="h-full w-1/3 bg-red-600" />
                </span>
              </span>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 lg:text-4xl">
              Heberge en France
            </h2>
            <p className="mt-4 text-gray-600">
              Vos donnees sont hebergees sur des serveurs en France (Hetzner,
              datacenter de Strasbourg). Conformite RGPD garantie. Aucune donnee
              ne quitte le territoire europeen.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-gray-100 p-4">
                <p className="text-2xl font-bold text-green-600">99.9%</p>
                <p className="text-sm text-gray-600">Disponibilite</p>
              </div>
              <div className="rounded-xl border border-gray-100 p-4">
                <p className="text-2xl font-bold text-green-600">RGPD</p>
                <p className="text-sm text-gray-600">100% conforme</p>
              </div>
              <div className="rounded-xl border border-gray-100 p-4">
                <p className="text-2xl font-bold text-green-600">SSL/TLS</p>
                <p className="text-sm text-gray-600">Chiffrement bout-en-bout</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-green-600 py-16">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <h2 className="text-3xl font-bold text-white lg:text-4xl">
            Pret a moderniser votre caisse ?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-green-100">
            Inscrivez-vous en 2 minutes et commencez a encaisser des
            aujourd&apos;hui. 14 jours d&apos;essai gratuit.
          </p>
          <Link
            href="/register"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-lg font-semibold text-green-700 shadow-lg transition hover:bg-green-50"
          >
            Creer mon compte gratuitement
            <ChevronRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white py-12">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-600 text-sm font-bold text-white">
                  N
                </div>
                <span className="font-bold text-gray-900">NovaCaisse</span>
              </div>
              <p className="mt-3 text-sm text-gray-500">
                Caisse enregistreuse SaaS pour la restauration rapide.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900">Produit</h4>
              <ul className="mt-3 space-y-2">
                <li>
                  <a href="#features" className="text-sm text-gray-500 hover:text-gray-700">
                    Fonctionnalites
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="text-sm text-gray-500 hover:text-gray-700">
                    Tarifs
                  </a>
                </li>
                <li>
                  <a href="#hosting" className="text-sm text-gray-500 hover:text-gray-700">
                    Securite
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900">Legal</h4>
              <ul className="mt-3 space-y-2">
                <li>
                  <span className="text-sm text-gray-500">Mentions legales</span>
                </li>
                <li>
                  <span className="text-sm text-gray-500">
                    Conditions generales
                  </span>
                </li>
                <li>
                  <span className="text-sm text-gray-500">
                    Politique de confidentialite
                  </span>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900">Contact</h4>
              <ul className="mt-3 space-y-2">
                <li>
                  <span className="text-sm text-gray-500">
                    contact@novacaisse.fr
                  </span>
                </li>
                <li>
                  <span className="text-sm text-gray-500">
                    support@novacaisse.fr
                  </span>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t border-gray-100 pt-8 text-center text-sm text-gray-400">
            &copy; {new Date().getFullYear()} NovaCaisse. Tous droits reserves.
          </div>
        </div>
      </footer>
    </div>
  );
}
