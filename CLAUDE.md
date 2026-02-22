# NOVACAISSE — Brief Projet Claude Code v2

> **Ce fichier est le CLAUDE.md du projet. Place-le à la racine du repo.**
> Il contient tout le contexte nécessaire pour développer NovaCaisse.

---

## 1. Contexte

**NovaCaisse** = SaaS de caisse enregistreuse pour fast foods en France.
Fondateur solo, profil DevOps, 1 mois pour sortir un MVP testable en conditions réelles dans un restaurant.

- **Cible** : Fast foods, snacks, kebabs, tacos, burgers, pizzerias
- **Plateforme** : PWA installable sur tablette/smartphone
- **Modèle** : 29€/mois (vs concurrents à 89-150€/mois)
- **Conformité** : ISCA obligatoire + auto-attestation (Loi Finances 2026, Art. 125)
- **Prédécesseur** : FlexPos (github.com/klibato/FlexPos) — 299 commits, multi-tenant, NF525. On repart clean en TypeScript avec une archi simplifiée.

---

## 2. Stack Technique

| Couche | Techno | Pourquoi |
|--------|--------|----------|
| Backend | **Fastify + TypeScript** | Validation JSON Schema native, plugins officiels, TS-first |
| ORM | **Prisma** | Type-safe, migrations auto, multi-tenant facile |
| Base de données | **PostgreSQL 16** | Transactions ACID pour ISCA, séquences, triggers |
| Cache/Sessions | **Redis 7** | Sessions JWT, rate limiting, queue BullMQ |
| Jobs async | **BullMQ** | Clôtures Z automatiques, archivage, exports |
| Frontend | **Next.js 14+ (App Router) + TypeScript** | PWA, SSR landing, App Router pour groupes de routes |
| State | **Zustand** | Simple, pas de provider hell (FlexPos avait 7 Context imbriqués) |
| Styling | **Tailwind CSS + shadcn/ui** | Rapide, composants accessibles, gros boutons tactiles |
| Data fetching | **TanStack Query (React Query)** | Cache, optimistic updates, sync offline |
| PWA | **next-pwa** | Service Worker, offline, install prompt |
| Conteneurisation | **Docker + Docker Compose** | Tout tourne en conteneurs, dev = prod |
| Reverse proxy | **Traefik** (prod) | HTTPS auto Let's Encrypt, routing |
| CI/CD | **GitHub Actions** | Lint, test, build, deploy |

### Plugins Fastify utilisés
```
@fastify/cors          # CORS
@fastify/helmet        # Headers sécurité
@fastify/rate-limit    # Rate limiting
@fastify/jwt           # Auth JWT intégrée
@fastify/cookie        # Cookies
@fastify/multipart     # Upload images
@fastify/swagger       # API docs auto-générée
```

---

## 3. Structure du Projet

```
novacaisse/
├── api/                          # Backend Fastify
│   ├── src/
│   │   ├── index.ts              # Entry point, register plugins
│   │   ├── plugins/
│   │   │   ├── auth.ts           # @fastify/jwt config + decorators
│   │   │   ├── prisma.ts         # Prisma client plugin
│   │   │   ├── tenant.ts         # Multi-tenant isolation plugin
│   │   │   └── redis.ts          # Redis connection plugin
│   │   ├── routes/
│   │   │   ├── auth.ts           # POST /auth/login (PIN), /auth/refresh
│   │   │   ├── products.ts       # CRUD produits
│   │   │   ├── categories.ts     # CRUD catégories
│   │   │   ├── menus.ts          # CRUD menus composites
│   │   │   ├── tickets.ts        # POST /tickets (encaissement)
│   │   │   ├── closures.ts       # GET /closures, POST /closures/manual
│   │   │   ├── dashboard.ts      # GET /dashboard (stats)
│   │   │   ├── settings.ts       # GET/PUT /settings (config commerce)
│   │   │   └── admin.ts          # Routes super-admin (tenants)
│   │   ├── isca/
│   │   │   ├── chain.ts          # Chaînage SHA-256
│   │   │   ├── signature.ts      # HMAC-SHA256 par ticket
│   │   │   ├── closure.ts        # Clôtures Z (daily/monthly/yearly)
│   │   │   ├── export.ts         # Export JDC (XML/CSV)
│   │   │   ├── verify.ts         # Vérificateur d'intégrité
│   │   │   └── index.ts          # API publique du module
│   │   ├── services/
│   │   │   ├── ticket.service.ts # Logique de création ticket
│   │   │   ├── payment.service.ts# Logique paiement mixte / split
│   │   │   └── closure.service.ts# Logique clôtures
│   │   ├── schemas/              # JSON Schemas Fastify (validation)
│   │   │   ├── ticket.schema.ts
│   │   │   ├── product.schema.ts
│   │   │   └── auth.schema.ts
│   │   ├── hooks/                # Fastify hooks (preHandler, etc.)
│   │   │   ├── auth.hook.ts      # Vérifie JWT
│   │   │   ├── rbac.hook.ts      # Vérifie rôle (owner/manager/cashier)
│   │   │   └── tenant.hook.ts    # Injecte tenant_id dans chaque requête
│   │   └── lib/
│   │       ├── errors.ts         # Classes d'erreurs custom
│   │       └── utils.ts          # Helpers (centimes, TVA, etc.)
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts               # Données de test
│   ├── tests/
│   │   ├── isca.test.ts          # Tests ISCA (couverture > 95%)
│   │   └── tickets.test.ts
│   ├── Dockerfile
│   ├── Dockerfile.dev            # Avec hot reload (tsx watch)
│   ├── tsconfig.json
│   └── package.json
│
├── web/                          # Frontend Next.js
│   ├── src/
│   │   ├── app/
│   │   │   ├── (pos)/           # Écran de caisse (grille produits, panier, paiement)
│   │   │   │   ├── page.tsx     # Page principale caisse
│   │   │   │   └── layout.tsx
│   │   │   ├── (admin)/         # Back-office
│   │   │   │   ├── products/    # Gestion produits
│   │   │   │   ├── categories/  # Gestion catégories
│   │   │   │   ├── menus/       # Gestion menus composites
│   │   │   │   ├── dashboard/   # Stats, CA, graphiques
│   │   │   │   ├── closures/    # Historique clôtures
│   │   │   │   ├── settings/    # Config commerce (SIRET, nom, adresse)
│   │   │   │   └── layout.tsx   # Layout admin (sidebar)
│   │   │   ├── (auth)/
│   │   │   │   └── login/       # Login par PIN
│   │   │   ├── (landing)/       # Site marketing (SSG)
│   │   │   │   └── page.tsx     # Landing page novacaisse.fr
│   │   │   └── layout.tsx       # Root layout
│   │   ├── components/
│   │   │   ├── pos/             # Composants caisse (ProductGrid, Cart, PaymentModal)
│   │   │   ├── admin/           # Composants back-office
│   │   │   ├── ui/              # shadcn/ui components
│   │   │   └── shared/          # Header, Sidebar, etc.
│   │   ├── stores/
│   │   │   ├── cart.store.ts    # Panier (articles, quantités, mode sur place/emporter)
│   │   │   ├── auth.store.ts    # Session utilisateur, JWT
│   │   │   └── config.store.ts  # Config commerce
│   │   ├── lib/
│   │   │   ├── api.ts           # Client API (fetch wrapper)
│   │   │   ├── vat.ts           # Calculs TVA
│   │   │   └── offline.ts       # Queue IndexedDB pour mode offline
│   │   └── types/
│   │       └── index.ts         # Types partagés
│   ├── public/
│   │   ├── manifest.json        # PWA manifest
│   │   └── icons/
│   ├── Dockerfile
│   ├── Dockerfile.dev
│   ├── next.config.js           # Config PWA
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── docker-compose.yml            # DEV : hot reload, volumes montés
├── docker-compose.prod.yml       # PROD : images buildées, Traefik
├── .env.example
├── .github/
│   └── workflows/
│       └── ci.yml                # Lint + test + build
└── README.md
```

---

## 4. Docker Compose

### Dev (docker-compose.yml)
```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: novacaisse
      POSTGRES_PASSWORD: novacaisse
      POSTGRES_DB: novacaisse
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U novacaisse"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s

  api:
    build:
      context: ./api
      dockerfile: Dockerfile.dev
    ports:
      - "4000:4000"
    volumes:
      - ./api/src:/app/src        # Hot reload
      - ./api/prisma:/app/prisma  # Schema sync
    environment:
      DATABASE_URL: postgresql://novacaisse:novacaisse@db:5432/novacaisse
      REDIS_URL: redis://redis:6379
      JWT_SECRET: dev-secret-change-in-prod
      NODE_ENV: development
      PORT: 4000
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy

  web:
    build:
      context: ./web
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    volumes:
      - ./web/src:/app/src        # Hot reload
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:4000
      NODE_ENV: development
    depends_on:
      - api

volumes:
  pgdata:
```

### Prod (docker-compose.prod.yml)
```yaml
services:
  traefik:
    image: traefik:v3.0
    command:
      - "--providers.docker=true"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
      - "--certificatesresolvers.letsencrypt.acme.email=${ACME_EMAIL}"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - letsencrypt:/letsencrypt

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: novacaisse
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    volumes:
      - redisdata:/data

  api:
    build:
      context: ./api
      dockerfile: Dockerfile
    environment:
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@db:5432/novacaisse
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
      NODE_ENV: production
      PORT: 4000
    labels:
      - "traefik.http.routers.api.rule=Host(`api.novacaisse.fr`)"
      - "traefik.http.routers.api.tls.certresolver=letsencrypt"
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy

  web:
    build:
      context: ./web
      dockerfile: Dockerfile
    environment:
      NEXT_PUBLIC_API_URL: https://api.novacaisse.fr
    labels:
      - "traefik.http.routers.web.rule=Host(`novacaisse.fr`)"
      - "traefik.http.routers.web.tls.certresolver=letsencrypt"
    depends_on:
      - api

volumes:
  pgdata:
  redisdata:
  letsencrypt:
```

---

## 5. Prisma Schema Complet

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── Multi-tenant ───

model Tenant {
  id               String   @id @default(cuid())
  name             String                          // "Kebab du Coin"
  siret            String
  address          String
  vatNumber        String?
  phone            String?
  email            String
  logoUrl          String?
  subscriptionPlan String   @default("starter")
  tenantSecret     String                          // clé HMAC pour signatures ISCA
  active           Boolean  @default(true)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  users      User[]
  categories Category[]
  products   Product[]
  menus      Menu[]
  tickets    Ticket[]
  closures   Closure[]
  archives   Archive[]
  auditLogs  AuditLog[]
}

// ─── Auth & RBAC ───

model User {
  id           String   @id @default(cuid())
  tenantId     String
  tenant       Tenant   @relation(fields: [tenantId], references: [id])
  name         String
  email        String?
  passwordHash String?
  pinCode      String                              // PIN 4-6 chiffres (hashé Argon2)
  role         Role     @default(CASHIER)
  active       Boolean  @default(true)
  createdAt    DateTime @default(now())

  @@unique([tenantId, pinCode])
}

enum Role {
  OWNER
  MANAGER
  CASHIER
}

// ─── Catalogue ───

model Category {
  id       String    @id @default(cuid())
  tenantId String
  tenant   Tenant    @relation(fields: [tenantId], references: [id])
  name     String
  color    String    @default("#3498db")
  position Int       @default(0)
  active   Boolean   @default(true)

  products Product[]
  menus    Menu[]
}

model Product {
  id              String    @id @default(cuid())
  tenantId        String
  tenant          Tenant    @relation(fields: [tenantId], references: [id])
  name            String
  priceHt         Int                               // centimes (850 = 8.50€)
  vatRateOnsite   Decimal   @default(10.0)           // TVA sur place
  vatRateTakeaway Decimal   @default(5.5)            // TVA à emporter
  categoryId      String?
  category        Category? @relation(fields: [categoryId], references: [id])
  imageUrl        String?
  supplements     Json?                              // [{name, priceHt, maxQty}]
  active          Boolean   @default(true)
  createdAt       DateTime  @default(now())

  menuItems MenuItem[]
}

model Menu {
  id              String    @id @default(cuid())
  tenantId        String
  tenant          Tenant    @relation(fields: [tenantId], references: [id])
  name            String
  priceHt         Int                               // prix menu en centimes
  vatRateOnsite   Decimal   @default(10.0)
  vatRateTakeaway Decimal   @default(5.5)
  categoryId      String?
  category        Category? @relation(fields: [categoryId], references: [id])
  imageUrl        String?
  active          Boolean   @default(true)
  createdAt       DateTime  @default(now())

  items MenuItem[]
}

model MenuItem {
  id          String  @id @default(cuid())
  menuId      String
  menu        Menu    @relation(fields: [menuId], references: [id], onDelete: Cascade)
  productId   String
  product     Product @relation(fields: [productId], references: [id])
  isChoice    Boolean @default(false)
  choiceGroup String?                               // "boisson", "accompagnement"
  position    Int     @default(0)
}

// ─── Ventes (ISCA) ───

model Ticket {
  id             String      @id @default(cuid())
  tenantId       String
  tenant         Tenant      @relation(fields: [tenantId], references: [id])
  sequenceNumber Int                                // compteur monotonique par tenant
  serviceMode    ServiceMode
  items          Json                                // [{name, qty, priceHt, vatRate, supplements}]
  totalHt        Int                                 // centimes
  totalTtc       Int                                 // centimes
  vatDetails     Json                                // [{rate, baseHt, amount}]
  payments       Json                                // [{method, amount}]
  isExpenseNote  Boolean     @default(false)
  isCancellation Boolean     @default(false)         // ticket d'annulation (réf à un autre ticket)
  cancelledRef   String?                             // id du ticket annulé si applicable
  hash           String                              // SHA-256
  prevHash       String                              // hash du ticket précédent
  signature      String                              // HMAC-SHA256
  userId         String?
  createdAt      DateTime    @default(now())

  @@unique([tenantId, sequenceNumber])
  @@index([tenantId, createdAt])
}

enum ServiceMode {
  ONSITE
  TAKEAWAY
}

model Closure {
  id        String      @id @default(cuid())
  tenantId  String
  tenant    Tenant      @relation(fields: [tenantId], references: [id])
  type      ClosureType
  date      DateTime
  totals    Json                                     // {totalHt, totalTtc, vatDetails, ticketCount, paymentBreakdown}
  hash      String
  createdAt DateTime    @default(now())

  @@unique([tenantId, type, date])
}

enum ClosureType {
  DAILY
  MONTHLY
  YEARLY
}

model Archive {
  id          String   @id @default(cuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  period      String                                 // "2026-03", "2026"
  filePath    String
  fileHash    String
  generatedAt DateTime @default(now())
}

model AuditLog {
  id        String   @id @default(cuid())
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  userId    String?
  action    String                                   // "ticket.create", "product.update"
  details   Json?
  ip        String?
  createdAt DateTime @default(now())

  @@index([tenantId, createdAt])
}
```

---

## 6. Module ISCA — Conformité Fiscale

**PRIORITÉ #1. Sans ça le logiciel est ILLÉGAL. 7 500€ d'amende par système non conforme.**

### 6.1 Chaînage SHA-256

Chaque ticket contient le hash du ticket précédent. C'est une blockchain simplifiée.

```typescript
// api/src/isca/chain.ts
import { createHash } from 'crypto';

interface ChainInput {
  tenantId: string;
  sequenceNumber: number;
  serviceMode: 'ONSITE' | 'TAKEAWAY';
  items: unknown[];
  totalHt: number;
  totalTtc: number;
  vatDetails: unknown[];
  payments: unknown[];
  isExpenseNote: boolean;
  createdAt: string; // ISO
}

export function computeHash(data: ChainInput, prevHash: string): string {
  const payload = JSON.stringify({ ...data, prevHash });
  return createHash('sha256').update(payload).digest('hex');
}
```

### 6.2 Signature HMAC-SHA256

Chaque ticket est signé avec la clé secrète du tenant.

```typescript
// api/src/isca/signature.ts
import { createHmac } from 'crypto';

export function signTicket(hash: string, tenantSecret: string): string {
  return createHmac('sha256', tenantSecret).update(hash).digest('hex');
}
```

### 6.3 Création d'un ticket (flux atomique)

```typescript
// api/src/services/ticket.service.ts
// TOUT dans une seule transaction PostgreSQL :
// 1. SELECT ... FOR UPDATE pour verrouiller le dernier ticket du tenant
// 2. Calculer sequenceNumber = last + 1
// 3. Calculer hash = SHA-256(ticketData + prevHash)
// 4. Calculer signature = HMAC-SHA256(hash, tenantSecret)
// 5. INSERT ticket
// 6. INSERT audit_log
// → Si n'importe quelle étape fail, ROLLBACK total
```

### 6.4 Clôtures Z

```
- Journalière : BullMQ job à minuit (ou manuelle via bouton)
- Mensuelle : BullMQ job le 1er du mois
- Annuelle : BullMQ job le 1er janvier
- Contenu : somme CA HT, TTC, TVA par taux, nombre tickets, ventilation paiements
- Chaque clôture est hashée et immuable
```

### 6.5 Règles ISCA absolues

- **JAMAIS** de DELETE sur la table tickets
- **JAMAIS** de UPDATE sur la table tickets
- Une annulation = un NOUVEAU ticket de type annulation qui référence l'ancien
- Le compteur séquentiel ne doit JAMAIS avoir de trou
- Les clôtures sont immuables une fois créées
- L'audit_log est append-only
- Rétention minimum 6 ans

---

## 7. Features Terrain (MVP)

### 7.1 Ticket Note de Frais
- Champ `isExpenseNote: true` dans le ticket
- Le ticket imprimé/PDF n'affiche PAS le détail des articles
- Affiche : nom commerce, SIRET, adresse, date/heure, total TTC, ventilation TVA
- Le ticket original complet reste dans la base (ISCA)

### 7.2 Paiement Mixte
- `payments: [{method: "cash", amount: 500}, {method: "card", amount: 490}]`
- Le frontend calcule le reste automatiquement quand le caissier entre le premier montant
- Moyens : cash, card, meal_voucher, check

### 7.3 Split par Article
- Chaque article du panier peut être assigné à un moyen de paiement
- Génère un seul ticket avec le détail des paiements par article
- Optionnel : peut générer plusieurs tickets (1 par groupe de paiement)

### 7.4 Sur place / À emporter
- Toggle en haut de l'écran de caisse
- Change le taux TVA sur TOUS les articles du panier :
  - Sur place → vatRateOnsite (10% par défaut)
  - À emporter → vatRateTakeaway (5.5% par défaut)
- Stocké dans `serviceMode: 'ONSITE' | 'TAKEAWAY'`

### 7.5 Menus Composites
- Le commerçant crée un menu dans le back-office
- Sélectionne des produits existants + prix fixe
- Les items avec `isChoice: true` = le client choisit (ex: quelle boisson)
- En caisse : bouton menu → sélection variantes → ajout au panier comme 1 item

### 7.6 Ticket Production Cuisine
- Envoyé à l'imprimante cuisine quand une commande est validée
- Contient : numéro commande, articles, quantités, suppléments, commentaires
- PAS de prix
- Gros caractères

### 7.7 Suppléments
- Chaque produit peut avoir des suppléments : `[{name: "Fromage", priceHt: 100, maxQty: 3}]`
- Le caissier les ajoute en caisse
- Ils apparaissent sur le ticket et le ticket cuisine

---

## 8. Règles de Code

- **TypeScript strict** (`strict: true`, zéro `any`)
- **Montants en centimes** (Int). 8.50€ = 850. Jamais de float pour l'argent.
- **Prix stockés en HT**, TTC calculé dynamiquement
- **Pas de DELETE/UPDATE** sur tables fiscales (tickets, closures, audit_log)
- **Soft delete** via `active: boolean` pour produits/catégories/menus
- **Tests** : Vitest pour unitaires, supertest pour API
- **Commits** : feat:, fix:, chore:, docs:
- **ESLint + Prettier** configurés
- **Chaque feature** dans une branche dédiée

---

## 9. Phases de Dev (4 semaines)

### Semaine 1 — Setup + ISCA
- Setup monorepo : api/ + web/ + Docker Compose
- Prisma schema complet + première migration
- Auth PIN + JWT + RBAC hooks
- Module ISCA complet (chain, signature, closure, export, verify)
- Tests ISCA > 95% couverture
- CRUD produits + catégories + menus

### Semaine 2 — Écran de caisse
- Grille produits tactile (gros boutons, couleurs, icônes)
- Panier Zustand (ajout, suppression, quantité, suppléments)
- Toggle sur place / à emporter (TVA auto)
- Sélection menus avec variantes
- Écran paiement (simple + mixte + split)
- Bouton note de frais
- Génération ticket (POST /tickets → ISCA)

### Semaine 3 — PWA + Impression + Dashboard
- PWA config (manifest, Service Worker, install prompt)
- Mode offline (IndexedDB queue + sync)
- Impression ticket client (ESC/POS ou PDF)
- Impression ticket cuisine
- Dashboard (CA jour, semaine, top produits, répartition paiements)
- Clôture Z manuelle + historique

### Semaine 4 — Production + Bêta
- Sécurité (rate limiting, validation, headers, CSRF)
- Tests d'intégration flux complet
- docker-compose.prod.yml + Traefik + HTTPS
- Landing page (Next.js SSG)
- Onboarding (création compte → config → premier ticket)
- Stripe (abonnement 29€/mois)
- Déploiement VPS Hetzner
- Bêta test restaurant

---

## 10. Commande de Démarrage

Commence par le setup Docker Compose + Prisma + Fastify de base (Semaine 1).
Ordre exact :
1. `docker-compose.yml` avec db + redis + api + web
2. Prisma schema + `prisma migrate dev`
3. Fastify hello world avec plugins (cors, jwt, helmet)
4. Plugin Prisma + plugin tenant isolation
5. Auth par PIN (POST /auth/login)
6. Module ISCA (chain.ts, signature.ts)
7. Route POST /tickets avec ISCA intégré
8. Tests ISCA

Quand tu proposes du code, privilégie :
1. **Conformité ISCA** (non négociable, c'est la loi)
2. **Simplicité** (pas d'over-engineering, on est solo avec 4 semaines)
3. **Tout en conteneurs** (docker compose up = ça tourne)
4. **Types stricts** (TypeScript, Prisma types)
