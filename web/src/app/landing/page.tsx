'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  Monitor,
  Building2,
  UtensilsCrossed,
  WifiOff,
  Printer,
  BarChart3,
  Check,
  ShieldCheck,
  Lock,
  Server,
  Flag,
} from 'lucide-react';

// ─── Scroll fade-in hook ───────────────────────────────────────────────────

function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('is-visible');
          observer.unobserve(el);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}

// ─── Data ──────────────────────────────────────────────────────────────────

const features = [
  {
    icon: Monitor,
    title: 'Caisse tactile',
    description:
      'Interface conçue pour tablette. Grands boutons, recherche rapide, raccourcis clavier pour les habitués.',
  },
  {
    icon: Building2,
    title: 'Multi-restaurant',
    description:
      'Chaque restaurant a son espace isolé, ses données, son équipe. Gérez tout depuis un seul compte.',
  },
  {
    icon: UtensilsCrossed,
    title: 'Menus & options',
    description:
      'Compositions de menus, choix viande / sauce / boisson, suppléments au ticket. Paramétrage complet.',
  },
  {
    icon: WifiOff,
    title: 'Mode hors-ligne',
    description:
      'Continuez d\'encaisser même sans internet. Les tickets se synchronisent automatiquement à la reconnexion.',
  },
  {
    icon: Printer,
    title: 'Impression directe',
    description:
      'Ticket client et ticket cuisine, imprimante thermique USB compatible ESC/POS. Zéro configuration.',
  },
  {
    icon: BarChart3,
    title: 'Dashboard & clôtures',
    description:
      'Chiffre d\'affaires, top produits, répartition des paiements. Clôtures Z automatiques à minuit.',
  },
];

const pricingFeatures = [
  'Nombre illimité de produits',
  'Multi-utilisateurs (connexion PIN)',
  'Conforme ISCA / loi Finances 2026',
  'Mode hors-ligne inclus',
  'Impression tickets client & cuisine',
  'Dashboard & statistiques',
  'Support par email',
  'Mises à jour incluses',
];

const steps = [
  {
    n: '01',
    title: 'Créez votre restaurant',
    description:
      'Remplissez le formulaire d\'inscription en 2 minutes. Choisissez le nom de votre établissement et votre URL. Aucune carte bancaire requise.',
  },
  {
    n: '02',
    title: 'Configurez vos produits',
    description:
      'Ajoutez vos articles, créez vos catégories, composez vos menus depuis le back-office. Importez votre carte existante en quelques clics.',
  },
  {
    n: '03',
    title: 'Encaissez',
    description:
      'Connectez-vous sur votre tablette ou smartphone, installez l\'app en un tap. Vous êtes prêt à vendre.',
  },
];

// ─── Sub-components ────────────────────────────────────────────────────────

function FadeSection({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useFadeIn();
  return (
    <div ref={ref} className={`fade-section ${className}`}>
      {children}
    </div>
  );
}

function MockPOS() {
  return (
    <div className="w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
      {/* Window chrome */}
      <div className="flex h-9 items-center gap-2 border-b border-slate-700 bg-slate-800 px-4">
        <span className="h-3 w-3 rounded-full bg-red-500/80" />
        <span className="h-3 w-3 rounded-full bg-yellow-500/80" />
        <span className="h-3 w-3 rounded-full bg-green-500/80" />
        <span className="ml-3 text-xs text-slate-500">caisse.novacaisse.fr</span>
      </div>

      <div className="flex h-[340px] gap-0 md:h-[360px]">
        {/* Product grid */}
        <div className="flex flex-1 flex-col overflow-hidden border-r border-slate-700">
          {/* Category tabs */}
          <div className="flex gap-1 border-b border-slate-700 bg-slate-800/60 p-2">
            {['Burgers', 'Tacos', 'Boissons', 'Desserts'].map((cat, i) => (
              <span
                key={cat}
                className={`rounded px-2.5 py-1 text-xs font-medium ${
                  i === 0
                    ? 'bg-green-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat}
              </span>
            ))}
          </div>
          {/* Products */}
          <div className="grid flex-1 grid-cols-3 gap-2 overflow-hidden p-3">
            {[
              { name: 'Classic Burger', price: '8,90' },
              { name: 'Double Cheese', price: '10,50' },
              { name: 'Burger Maison', price: '11,90' },
              { name: 'Bacon Crispy', price: '12,00' },
              { name: 'Veggie Burger', price: '9,50' },
              { name: 'Kids Burger', price: '7,50' },
            ].map((p) => (
              <div
                key={p.name}
                className="flex flex-col items-start justify-between rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-left"
              >
                <div className="h-8 w-8 rounded bg-slate-700" />
                <div className="mt-2 w-full">
                  <p className="truncate text-xs font-medium text-slate-200">
                    {p.name}
                  </p>
                  <p className="mt-0.5 text-xs text-green-400">{p.price} €</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cart */}
        <div className="flex w-44 flex-col bg-slate-800/40 md:w-52">
          <div className="border-b border-slate-700 px-3 py-2">
            <p className="text-xs font-semibold text-slate-300">Commande #47</p>
            <div className="mt-1 flex gap-2">
              <span className="rounded bg-green-700/40 px-2 py-0.5 text-[10px] font-medium text-green-400">
                Sur place
              </span>
            </div>
          </div>
          <div className="flex-1 space-y-2 overflow-hidden px-3 py-2">
            {[
              { name: 'Classic Burger', qty: 2, total: '17,80' },
              { name: 'Frites Maison', qty: 1, total: '3,50' },
              { name: 'Coca-Cola', qty: 2, total: '5,00' },
            ].map((item) => (
              <div key={item.name} className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-slate-300">{item.name}</p>
                  <p className="text-[10px] text-slate-500">x{item.qty}</p>
                </div>
                <p className="text-xs text-slate-300">{item.total} €</p>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-700 px-3 py-3">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Sous-total</span>
              <span>26,30 €</span>
            </div>
            <div className="mt-0.5 flex justify-between text-xs text-slate-400">
              <span>TVA 10%</span>
              <span>2,39 €</span>
            </div>
            <div className="mt-2 flex justify-between text-sm font-semibold text-white">
              <span>Total TTC</span>
              <span>26,30 €</span>
            </div>
            <button className="mt-3 w-full rounded-lg bg-green-600 py-2 text-xs font-semibold text-white">
              Encaisser
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <style>{`
        .fade-section {
          opacity: 0;
          transform: translateY(24px);
          transition: opacity 0.55s ease, transform 0.55s ease;
        }
        .fade-section.is-visible {
          opacity: 1;
          transform: translateY(0);
        }
      `}</style>

      <div className="min-h-screen bg-white text-gray-900">

        {/* ── NAVBAR ───────────────────────────────────────── */}
        <header
          className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
            scrolled
              ? 'border-b border-slate-700 bg-slate-900'
              : 'bg-transparent'
          }`}
        >
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
            <a href="#" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-600 text-sm font-bold text-white">
                N
              </span>
              <span className="text-lg font-bold text-white">NovaCaisse</span>
            </a>

            <nav className="hidden items-center gap-7 md:flex">
              <a
                href="#features"
                className="text-sm text-slate-300 transition hover:text-white"
              >
                Fonctionnalités
              </a>
              <a
                href="#how"
                className="text-sm text-slate-300 transition hover:text-white"
              >
                Comment ça marche
              </a>
              <a
                href="#pricing"
                className="text-sm text-slate-300 transition hover:text-white"
              >
                Tarifs
              </a>
              <a
                href="#contact"
                className="text-sm text-slate-300 transition hover:text-white"
              >
                Contact
              </a>
            </nav>

            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-400 hover:text-white"
              >
                Connexion
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
              >
                Essayer gratuitement
              </Link>
            </div>
          </div>
        </header>

        {/* ── HERO ─────────────────────────────────────────── */}
        <section className="bg-slate-900 pb-20 pt-28 md:pt-32 lg:pb-28 lg:pt-36">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <div className="flex flex-col items-center gap-12 lg:flex-row lg:gap-16">
              {/* Copy */}
              <div className="flex-1 text-center lg:text-left">
                <div className="inline-flex items-center gap-2 rounded-full border border-green-800 bg-green-950 px-3 py-1 text-sm text-green-400">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Conforme loi Finances 2026 — ISCA
                </div>

                <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-white lg:text-5xl xl:text-6xl">
                  La caisse enregistreuse pensée pour les fast-foods français
                </h1>

                <p className="mt-5 text-base leading-relaxed text-slate-400 lg:text-lg">
                  Gérez vos commandes, encaissez, imprimez vos tickets. Conforme
                  à la réglementation française. Prêt en 2 minutes.
                </p>

                <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
                  <Link
                    href="/register"
                    className="w-full rounded-lg bg-green-600 px-7 py-3.5 text-center text-base font-semibold text-white transition hover:bg-green-700 sm:w-auto"
                  >
                    Créer mon restaurant
                  </Link>
                  <a
                    href="#how"
                    className="w-full rounded-lg border border-slate-600 px-7 py-3.5 text-center text-base font-medium text-slate-300 transition hover:border-slate-400 hover:text-white sm:w-auto"
                  >
                    Voir la démo
                  </a>
                </div>
              </div>

              {/* Mock screenshot */}
              <div className="w-full flex-1">
                <MockPOS />
              </div>
            </div>
          </div>
        </section>

        {/* ── BANDEAU CONFIANCE ─────────────────────────────── */}
        <section className="border-y border-gray-100 bg-white py-6">
          <div className="mx-auto max-w-5xl px-4 md:px-6">
            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-sm text-gray-500">
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-green-600" />
                Conforme NF525
              </span>
              <span className="hidden text-gray-300 md:inline">|</span>
              <span className="flex items-center gap-2">
                <Flag className="h-4 w-4 text-blue-700" />
                Hébergé en France
              </span>
              <span className="hidden text-gray-300 md:inline">|</span>
              <span className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-green-600" />
                RGPD
              </span>
              <span className="hidden text-gray-300 md:inline">|</span>
              <span className="flex items-center gap-2">
                <Server className="h-4 w-4 text-green-600" />
                Données chiffrées
              </span>
            </div>
          </div>
        </section>

        {/* ── FONCTIONNALITÉS ───────────────────────────────── */}
        <section id="features" className="bg-slate-50 py-20 lg:py-28">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <FadeSection className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 lg:text-4xl">
                Tout ce qu&apos;il faut pour encaisser
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-gray-500">
                NovaCaisse est conçu pour la restauration rapide. Pas de
                fonctionnalités superflues — juste l&apos;essentiel, fait
                correctement.
              </p>
            </FadeSection>

            <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {features.map((f, i) => (
                <FadeSection key={f.title} style={{ transitionDelay: `${i * 60}ms` } as React.CSSProperties}>
                  <div className="h-full rounded-xl border border-gray-200 bg-white p-6 transition hover:border-green-300 hover:shadow-md">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-green-600">
                      <f.icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 text-base font-semibold text-gray-900">
                      {f.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-gray-500">
                      {f.description}
                    </p>
                  </div>
                </FadeSection>
              ))}
            </div>
          </div>
        </section>

        {/* ── COMMENT ÇA MARCHE ─────────────────────────────── */}
        <section id="how" className="bg-white py-20 lg:py-28">
          <div className="mx-auto max-w-4xl px-4 md:px-6">
            <FadeSection className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 lg:text-4xl">
                Comment ça marche
              </h2>
              <p className="mt-4 text-gray-500">
                De l&apos;inscription au premier ticket, comptez moins de 10
                minutes.
              </p>
            </FadeSection>

            <div className="mt-14 space-y-10">
              {steps.map((step, i) => (
                <FadeSection
                  key={step.n}
                  style={{ transitionDelay: `${i * 100}ms` } as React.CSSProperties}
                >
                  <div className="flex gap-6 md:gap-10">
                    <div className="flex-shrink-0">
                      <span className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-green-600 text-lg font-extrabold text-green-600">
                        {step.n}
                      </span>
                    </div>
                    <div className="pt-1">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {step.title}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-gray-500">
                        {step.description}
                      </p>
                    </div>
                  </div>
                  {i < steps.length - 1 && (
                    <div className="ml-6 mt-3 h-8 w-px bg-gray-200" />
                  )}
                </FadeSection>
              ))}
            </div>
          </div>
        </section>

        {/* ── TARIFS ───────────────────────────────────────── */}
        <section id="pricing" className="bg-slate-900 py-20 lg:py-28">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <FadeSection className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-white lg:text-4xl">
                Tarifs
              </h2>
              <p className="mt-4 text-slate-400">
                Pas de carte bancaire, pas d&apos;engagement.
              </p>
            </FadeSection>

            <FadeSection className="mx-auto mt-12 max-w-md">
              <div className="overflow-hidden rounded-xl border border-green-600 bg-slate-800">
                {/* Card header */}
                <div className="px-8 pb-6 pt-8 text-center">
                  <span className="inline-block rounded-full bg-green-600 px-3 py-0.5 text-xs font-semibold uppercase tracking-wide text-white">
                    Offre Bêta
                  </span>
                  <div className="mt-4 text-6xl font-extrabold text-white">
                    Gratuit
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-slate-400">
                    Pendant la période bêta, NovaCaisse est 100&nbsp;% gratuit.
                    Pas de carte bancaire requise.
                  </p>
                </div>

                {/* Divider */}
                <div className="border-t border-slate-700" />

                {/* Features */}
                <div className="px-8 py-6">
                  <ul className="space-y-3">
                    {pricingFeatures.map((item) => (
                      <li
                        key={item}
                        className="flex items-center gap-3 text-sm text-slate-300"
                      >
                        <Check className="h-4 w-4 flex-shrink-0 text-green-500" />
                        {item}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href="/register"
                    className="mt-8 block w-full rounded-lg bg-green-600 py-3.5 text-center text-sm font-semibold text-white transition hover:bg-green-700"
                  >
                    Commencer gratuitement
                  </Link>
                  <p className="mt-3 text-center text-xs text-slate-500">
                    L&apos;offre bêta ne demande aucune information bancaire.
                  </p>
                </div>
              </div>
            </FadeSection>
          </div>
        </section>

        {/* ── FOOTER ───────────────────────────────────────── */}
        <footer id="contact" className="border-t border-slate-800 bg-slate-900 py-14">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <div className="grid gap-10 md:grid-cols-4">
              {/* Brand */}
              <div className="md:col-span-1">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-600 text-sm font-bold text-white">
                    N
                  </span>
                  <span className="font-bold text-white">NovaCaisse</span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">
                  Caisse enregistreuse SaaS pour la restauration rapide.
                  Conforme à la réglementation française.
                </p>
              </div>

              {/* Produit */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Produit
                </h4>
                <ul className="mt-4 space-y-2.5">
                  <li>
                    <a
                      href="#features"
                      className="text-sm text-slate-400 transition hover:text-slate-200"
                    >
                      Fonctionnalités
                    </a>
                  </li>
                  <li>
                    <a
                      href="#pricing"
                      className="text-sm text-slate-400 transition hover:text-slate-200"
                    >
                      Tarifs
                    </a>
                  </li>
                </ul>
              </div>

              {/* Légal */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Légal
                </h4>
                <ul className="mt-4 space-y-2.5">
                  <li>
                    <span className="text-sm text-slate-500">
                      Mentions légales
                    </span>
                  </li>
                  <li>
                    <span className="text-sm text-slate-500">CGU</span>
                  </li>
                  <li>
                    <span className="text-sm text-slate-500">
                      Politique de confidentialité
                    </span>
                  </li>
                </ul>
              </div>

              {/* Contact */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Contact
                </h4>
                <ul className="mt-4 space-y-2.5">
                  <li>
                    <span className="text-sm text-slate-400">
                      contact@novacaisse.fr
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-12 border-t border-slate-800 pt-8 text-center text-xs text-slate-500">
              &copy; 2026 NovaCaisse &mdash; Hébergé en France
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
