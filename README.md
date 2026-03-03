# NovaCaisse

Caisse enregistreuse SaaS pour fast foods en France — conforme ISCA (Loi Finances 2026, Art. 125).

PWA installable sur tablette et smartphone, pensée pour kebabs, tacos, burgers, pizzerias et snacks.

**29 €/mois** — simple, rapide, conforme.

---

## Fonctionnalités

- **Écran de caisse tactile** — Grille produits avec catégories, couleurs, recherche instantanée
- **Menus composites** — Menus avec variantes (choix boisson, accompagnement)
- **Suppléments** — Fromage, sauce, etc. avec prix et quantité max
- **Sur place / À emporter** — Toggle qui ajuste automatiquement le taux de TVA
- **Paiement mixte** — Espèces + CB + Ticket Resto + Chèque, par montant ou par article
- **Note de frais** — Ticket simplifié sans détail articles (conforme fiscalement)
- **Annulation ISCA** — Création d'un ticket d'annulation (jamais de suppression)
- **Ticket cuisine** — Impression gros caractères sans prix
- **Clôtures Z** — Journalières automatiques (BullMQ) + manuelles + mensuelles
- **Dashboard** — CA, panier moyen, top produits, ventilation paiements, comparaison période précédente
- **Export CSV** — Tickets et clôtures exportables
- **Mode offline** — File d'attente IndexedDB, synchronisation automatique au retour réseau
- **Impression** — PDF (client + cuisine) et ESC/POS via WebUSB
- **PWA** — Installable, Service Worker, manifest
- **Multi-tenant** — Isolation par sous-domaine (kebab-du-coin.novacaisse.fr)
- **RBAC** — 3 rôles : OWNER, MANAGER, CASHIER
- **Dark mode** — Thème clair/sombre/système

---

## Stack technique

| Couche | Techno |
|---|---|
| Backend | Fastify + TypeScript |
| ORM | Prisma |
| Base de données | PostgreSQL 16 |
| Cache / Sessions | Redis 7 |
| Jobs async | BullMQ |
| Frontend | Next.js 14 (App Router) + TypeScript |
| State management | Zustand |
| UI | Tailwind CSS + shadcn/ui |
| Data fetching | TanStack Query |
| PWA | next-pwa |
| Conteneurisation | Docker + Docker Compose |
| Reverse proxy (prod) | Traefik v3 |
| CI/CD | GitHub Actions |

---

## Prérequis

- **Docker** >= 20.10 et **Docker Compose** >= 2.0
- **Node.js** >= 18 (uniquement pour le dev hors conteneur)
- **Git**

---

## Installation

### 1. Cloner le repo

```bash
git clone https://github.com/klibato/NovaCaisse.git
cd NovaCaisse
```

### 2. Copier les variables d'environnement

```bash
cp .env.example .env
```

### 3. Lancer l'environnement de développement

```bash
docker compose up --build
```

Cela démarre :

| Service | Port | Description |
|---|---|---|
| `db` | 5432 | PostgreSQL 16 |
| `redis` | 6379 | Redis 7 |
| `api` | 4000 | API Fastify (hot reload) |
| `web` | 3000 | Frontend Next.js (hot reload) |

### 4. Appliquer les migrations et le seed

```bash
docker compose exec api npx prisma migrate dev
docker compose exec api npx prisma db seed
```

### 5. Accéder à l'application

- **Frontend** : http://localhost:3000
- **API** : http://localhost:4000
- **Swagger** : http://localhost:4000/docs
- **Sous-domaine dev** : http://demo.localhost:3000

---

## Multi-tenant

Chaque restaurant est un **tenant** isolé, identifié par un sous-domaine :

```
kebab-du-coin.novacaisse.fr  →  tenant "kebab-du-coin"
demo.localhost:3000           →  tenant "demo" (dev)
```

Le middleware Next.js extrait le slug du sous-domaine et le stocke dans un cookie `tenant-slug`. Le client API envoie ensuite le header `X-Tenant-Slug` à chaque requête. Côté backend, le plugin `subdomain` résout le tenant correspondant.

Toutes les requêtes Prisma filtrent par `tenantId` — un tenant ne peut jamais accéder aux données d'un autre.

---

## Architecture du projet

```
NovaCaisse/
├── api/                          # Backend Fastify
│   ├── src/
│   │   ├── index.ts              # Entry point
│   │   ├── plugins/              # Plugins Fastify (auth, prisma, redis, tenant, subdomain)
│   │   ├── routes/               # Routes API (auth, tickets, products, categories, menus, closures, dashboard, settings, users)
│   │   ├── isca/                 # Module conformité fiscale (chain, signature, closure, export, verify)
│   │   ├── services/             # Logique métier (ticket, print)
│   │   ├── hooks/                # Hooks Fastify (RBAC)
│   │   ├── jobs/                 # BullMQ jobs (clôtures automatiques)
│   │   └── lib/                  # Utilitaires (errors, utils)
│   ├── prisma/
│   │   ├── schema.prisma         # Schéma de base de données
│   │   └── seed.ts               # Données de test
│   └── tests/                    # Tests Vitest
│
├── web/                          # Frontend Next.js
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/           # Login par PIN
│   │   │   ├── (pos)/            # Écran de caisse
│   │   │   ├── (admin)/          # Back-office (dashboard, produits, catégories, menus, clôtures, settings, tickets, users)
│   │   │   └── layout.tsx        # Root layout
│   │   ├── components/
│   │   │   ├── pos/              # Composants caisse (ProductGrid, Cart, PaymentModal, etc.)
│   │   │   ├── shared/           # Composants partagés (ThemeToggle, InstallPrompt, OfflineBadge)
│   │   │   └── ui/               # shadcn/ui
│   │   ├── stores/               # Zustand (auth, cart, connectivity, printer, theme)
│   │   ├── lib/                  # API client, offline, utils, thermal-printer
│   │   ├── hooks/                # useKeyboardShortcuts
│   │   └── types/                # TypeScript types
│   └── middleware.ts             # Extraction sous-domaine
│
├── docker-compose.yml            # Dev
├── docker-compose.prod.yml       # Prod (Traefik + HTTPS)
├── .env.example                  # Variables d'environnement
└── CLAUDE.md                     # Contexte projet
```

---

## Routes API

### Auth
| Méthode | Route | Auth | Description |
|---|---|---|---|
| POST | `/auth/login` | Non | Connexion par PIN |
| POST | `/auth/refresh` | Non | Renouveler le JWT |
| GET | `/auth/me` | Oui | Infos utilisateur connecté |

### Produits
| Méthode | Route | Rôle min. | Description |
|---|---|---|---|
| GET | `/products` | CASHIER | Liste des produits |
| GET | `/products/:id` | CASHIER | Détail produit |
| POST | `/products` | MANAGER | Créer un produit |
| PUT | `/products/:id` | MANAGER | Modifier un produit |
| DELETE | `/products/:id` | MANAGER | Supprimer un produit |
| PATCH | `/products/:id/toggle` | MANAGER | Activer/désactiver |

### Catégories
| Méthode | Route | Rôle min. | Description |
|---|---|---|---|
| GET | `/categories` | CASHIER | Liste des catégories |
| GET | `/categories/:id` | CASHIER | Détail catégorie |
| POST | `/categories` | MANAGER | Créer une catégorie |
| PUT | `/categories/:id` | MANAGER | Modifier une catégorie |
| DELETE | `/categories/:id` | MANAGER | Supprimer une catégorie |
| PATCH | `/categories/:id/toggle` | MANAGER | Activer/désactiver |

### Menus
| Méthode | Route | Rôle min. | Description |
|---|---|---|---|
| GET | `/menus` | CASHIER | Liste des menus |
| GET | `/menus/:id` | CASHIER | Détail menu |
| POST | `/menus` | MANAGER | Créer un menu |
| PUT | `/menus/:id` | MANAGER | Modifier un menu |
| DELETE | `/menus/:id` | MANAGER | Supprimer un menu |
| PATCH | `/menus/:id/toggle` | MANAGER | Activer/désactiver |

### Tickets (ISCA)
| Méthode | Route | Rôle min. | Description |
|---|---|---|---|
| POST | `/tickets` | CASHIER | Créer un ticket (encaissement) |
| GET | `/tickets` | CASHIER | Liste paginée |
| GET | `/tickets/export` | CASHIER | Export CSV |
| GET | `/tickets/:id` | CASHIER | Détail ticket |
| POST | `/tickets/:id/print` | CASHIER | PDF ticket client |
| POST | `/tickets/:id/print-kitchen` | CASHIER | PDF ticket cuisine |
| POST | `/tickets/:id/cancel` | CASHIER | Annuler un ticket |

### Clôtures
| Méthode | Route | Rôle min. | Description |
|---|---|---|---|
| GET | `/closures` | CASHIER | Liste paginée |
| GET | `/closures/export` | CASHIER | Export CSV |
| GET | `/closures/:id` | CASHIER | Détail clôture |
| POST | `/closures/daily` | MANAGER | Clôture journalière manuelle |
| POST | `/closures/monthly` | MANAGER | Clôture mensuelle manuelle |

### Dashboard
| Méthode | Route | Rôle min. | Description |
|---|---|---|---|
| GET | `/dashboard/stats` | CASHIER | Statistiques (period=today/week/month/year) |

### Settings
| Méthode | Route | Rôle min. | Description |
|---|---|---|---|
| GET | `/settings` | CASHIER | Infos du commerce |
| PUT | `/settings` | OWNER | Modifier les infos |

### Users
| Méthode | Route | Rôle min. | Description |
|---|---|---|---|
| GET | `/users` | MANAGER | Liste des utilisateurs |
| POST | `/users` | MANAGER | Créer un utilisateur |
| PUT | `/users/:id` | MANAGER | Modifier un utilisateur |
| PATCH | `/users/:id/pin` | MANAGER | Changer le PIN |
| PATCH | `/users/:id/toggle` | MANAGER | Activer/désactiver |
| DELETE | `/users/:id` | MANAGER | Supprimer un utilisateur |

### Autres
| Méthode | Route | Auth | Description |
|---|---|---|---|
| GET | `/health` | Non | Health check |
| GET | `/docs` | Non | Swagger UI |
| GET | `/tenants/by-slug/:slug` | Non | Résoudre un tenant par slug |

---

## Conformité ISCA

NovaCaisse implémente les exigences ISCA (Inaltérabilité, Sécurisation, Conservation, Archivage) :

- **Chaînage SHA-256** — Chaque ticket contient le hash du ticket précédent (blockchain simplifiée)
- **Signature HMAC-SHA256** — Chaque ticket est signé avec la clé secrète du tenant
- **Séquence monotonique** — Compteur sans trou, verrouillé par `SELECT FOR UPDATE`
- **Aucune suppression** — Les tickets ne sont jamais supprimés ni modifiés
- **Annulation par nouveau ticket** — Un ticket d'annulation négatif est créé, l'original est marqué comme annulé
- **Clôtures immuables** — Une fois créée, une clôture ne peut pas être modifiée
- **Audit log append-only** — Toutes les actions sont tracées
- **Vérification d'intégrité** — Module de vérification de la chaîne complète
- **Export JDC** — Journal des Données de Caisse exportable (JSON/CSV)
- **Rétention 6 ans** — Les données ne sont jamais purgées

---

## Tests

```bash
# Lancer les tests unitaires ISCA
docker compose exec api npx vitest run

# Lancer les tests en mode watch
docker compose exec api npx vitest
```

Les tests couvrent :
- Chaînage SHA-256 (déterminisme, détection de falsification)
- Signatures HMAC-SHA256 (validité, rejet, clé incorrecte)
- Séquence monotonique (continuité, pas de trous)
- Flux complet ISCA (chaîne de 10 tickets signés)
- Tickets d'annulation dans la chaîne
- Notes de frais
- Distinction sur place / à emporter

---

## Production

```bash
# Configurer les variables de production dans .env
# Puis lancer :
docker compose -f docker-compose.prod.yml up -d --build
```

Le fichier `docker-compose.prod.yml` inclut :
- **Traefik v3** — Reverse proxy avec HTTPS automatique (Let's Encrypt)
- **PostgreSQL** — Avec volumes persistants
- **Redis** — Avec volumes persistants
- Routing : `novacaisse.fr` → web, `api.novacaisse.fr` → api

---

## Variables d'environnement

Voir [`.env.example`](.env.example) pour la liste complète.

| Variable | Description | Exemple |
|---|---|---|
| `DATABASE_URL` | URL de connexion PostgreSQL | `postgresql://user:pass@db:5432/novacaisse` |
| `POSTGRES_USER` | Utilisateur PostgreSQL | `novacaisse` |
| `POSTGRES_PASSWORD` | Mot de passe PostgreSQL | `changeme` |
| `POSTGRES_DB` | Nom de la base | `novacaisse` |
| `REDIS_URL` | URL de connexion Redis | `redis://redis:6379` |
| `JWT_SECRET` | Secret pour signer les JWT | (générer un secret aléatoire) |
| `CORS_ORIGIN` | Origine autorisée CORS | `http://localhost:3000` |
| `NODE_ENV` | Environnement | `development` / `production` |
| `PORT` | Port de l'API | `4000` |
| `NEXT_PUBLIC_API_URL` | URL de l'API (côté client) | `http://localhost:4000` |
| `DB_USER` | (prod) Utilisateur DB | `novacaisse` |
| `DB_PASSWORD` | (prod) Mot de passe DB | (secret) |
| `ACME_EMAIL` | (prod) Email pour Let's Encrypt | `admin@novacaisse.fr` |

---

## Licence

Propriétaire — Tous droits réservés.
