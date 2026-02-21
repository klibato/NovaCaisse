# NOVACAISSE — Brief Projet pour Claude Code

## Contexte

Tu vas m'aider à développer **NovaCaisse**, un SaaS de caisse enregistreuse simplifié et abordable pour les fast foods en France. Je suis développeur solo (profil DevOps), bootstrap 0€, objectif MVP en 3 mois.

---

## 1. Vision Produit

**NovaCaisse** = les features des solutions à 89-150€/mois (Zelty, L'Addition) au prix de 29€/mois, avec la simplicité d'une app mobile.

- **Cible** : Fast foods, snacks, kebabs, tacos, burgers, pizzerias en France
- **Plateforme** : PWA (Progressive Web App) installable sur tablette et smartphone
- **Modèle** : Abonnement SaaS 29€/mois
- **Conformité** : ISCA obligatoire (Inaltérabilité, Sécurisation, Conservation, Archivage) + auto-attestation éditeur (Loi Finances 2026, Art. 125)

---

## 2. Stack Technique

### Frontend
- **Next.js 14+** (App Router)
- **TypeScript** strict
- **Tailwind CSS** + **shadcn/ui**
- **Zustand** (state management : panier, session caisse, mode offline)
- **next-pwa** (Service Worker, mode offline, install prompt)
- **React Query / TanStack Query** (cache + sync données serveur)

### Backend
- **Fastify** (API REST, validation JSON Schema)
- **TypeScript**
- **Prisma ORM** (PostgreSQL)
- **PostgreSQL 16** (base principale)
- **Redis 7** (cache sessions, rate limiting, queue)
- **BullMQ** (jobs async : clôtures Z, archivage, génération PDF)
- **JWT + Argon2** (auth, refresh tokens)

### Infrastructure
- **Docker + Docker Compose** (tous les services)
- **Traefik** (reverse proxy, HTTPS auto Let's Encrypt)
- **GitHub Actions** (CI/CD)
- **Prometheus + Grafana** (monitoring)

### Structure Monorepo (Turborepo)
```
novacaisse/
├── apps/
│   ├── web/          # Next.js PWA (frontend caisse + site marketing)
│   └── api/          # Fastify API REST
├── packages/
│   ├── shared/       # Types TypeScript partagés, constantes, utils
│   ├── isca/         # Module ISCA (chaînage crypto, signatures, clôtures)
│   └── db/           # Prisma schema + client généré
├── docker-compose.yml
├── turbo.json
└── package.json
```

---

## 3. Conformité Fiscale ISCA (PRIORITÉ #1 ABSOLUE)

Sans ce module, le logiciel est ILLÉGAL et les clients risquent 7 500€ d'amende. Il doit être implémenté en premier.

### 3.1 Inaltérabilité
- **Chaînage cryptographique SHA-256** : chaque ticket contient le hash du ticket précédent (principe blockchain)
- **Compteur séquentiel monotonique** par tenant, sans trou, géré en transaction PostgreSQL
- **Journal append-only** : aucune suppression ni modification de ticket possible
- Toute annulation/correction crée un NOUVEAU ticket d'annulation, ne modifie jamais l'ancien

### 3.2 Sécurisation
- **Signature HMAC-SHA256** par ticket avec clé secrète unique par tenant
- **RBAC** : 3 rôles (owner, manager, cashier) avec permissions différentes
- **Audit log** append-only de toutes les actions (connexion, vente, annulation, modification produit, etc.)

### 3.3 Conservation
- **Clôtures automatiques** :
  - Z journalière (job BullMQ à minuit ou déclenchement manuel)
  - Mensuelle (1er du mois)
  - Annuelle (1er janvier)
- Chaque clôture produit des **totaux cumulés immuables** (CA HT, TTC, TVA par taux, nombre de tickets, ventilation par moyen de paiement)
- **Rétention minimum 6 ans** (obligation fiscale)

### 3.4 Archivage
- **Export JDC** (Journal De Caisse) au format XML ou CSV ouvert
- Archives signées et horodatées
- Traçabilité complète de chaque archive produite
- Vérificateur d'intégrité de chaîne intégré (détection de trou/altération)

### Implémentation suggérée pour le chaînage :
```typescript
// packages/isca/src/chain.ts
interface TicketData {
  tenantId: string;
  sequenceNumber: number;
  items: TicketItem[];
  totalHt: number;
  totalTtc: number;
  vatDetails: VatDetail[];
  payments: Payment[];
  serviceMode: 'onsite' | 'takeaway';
  isExpenseNote: boolean;
  createdAt: Date;
}

function computeHash(ticketData: TicketData, previousHash: string): string {
  const payload = JSON.stringify({
    ...ticketData,
    previousHash,
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

function computeSignature(hash: string, tenantSecret: string): string {
  return crypto.createHmac('sha256', tenantSecret).update(hash).digest('hex');
}
```

---

## 4. Modèle de Données (Prisma Schema)

```prisma
model Tenant {
  id              String   @id @default(cuid())
  name            String
  siret           String
  address         String
  vatNumber       String?
  phone           String?
  email           String
  logoUrl         String?
  subscriptionPlan String  @default("starter")
  tenantSecret    String   // clé HMAC pour signatures ISCA
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  users      User[]
  categories Category[]
  products   Product[]
  menus      Menu[]
  tickets    Ticket[]
  closures   Closure[]
  archives   Archive[]
  auditLogs  AuditLog[]
}

model User {
  id           String   @id @default(cuid())
  tenantId     String
  tenant       Tenant   @relation(fields: [tenantId], references: [id])
  name         String
  email        String
  passwordHash String
  role         Role     @default(CASHIER)
  pinCode      String?  // PIN rapide pour switch de caissier
  active       Boolean  @default(true)
  createdAt    DateTime @default(now())

  @@unique([tenantId, email])
}

enum Role {
  OWNER
  MANAGER
  CASHIER
}

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
  id              String   @id @default(cuid())
  tenantId        String
  tenant          Tenant   @relation(fields: [tenantId], references: [id])
  name            String
  priceHt         Int      // en centimes (ex: 850 = 8.50€)
  vatRateOnsite   Decimal  @default(10.0)  // TVA sur place (10%)
  vatRateTakeaway Decimal  @default(5.5)   // TVA à emporter (5.5%)
  categoryId      String?
  category        Category? @relation(fields: [categoryId], references: [id])
  imageUrl        String?
  options         Json?    // ex: [{"name": "Sauce", "choices": ["Ketchup", "Mayo", "Algérienne"], "maxChoices": 1}]
  active          Boolean  @default(true)
  createdAt       DateTime @default(now())

  menuItems MenuItem[]
}

model Menu {
  id              String   @id @default(cuid())
  tenantId        String
  tenant          Tenant   @relation(fields: [tenantId], references: [id])
  name            String
  priceHt         Int      // prix du menu en centimes
  vatRateOnsite   Decimal  @default(10.0)
  vatRateTakeaway Decimal  @default(5.5)
  categoryId      String?
  category        Category? @relation(fields: [categoryId], references: [id])
  imageUrl        String?
  active          Boolean  @default(true)
  createdAt       DateTime @default(now())

  items MenuItem[]
}

model MenuItem {
  id          String  @id @default(cuid())
  menuId      String
  menu        Menu    @relation(fields: [menuId], references: [id])
  productId   String
  product     Product @relation(fields: [productId], references: [id])
  isChoice    Boolean @default(false)  // true = le client choisit parmi un groupe
  choiceGroup String? // ex: "boisson", "accompagnement"
  position    Int     @default(0)
}

model Ticket {
  id             String   @id @default(cuid())
  tenantId       String
  tenant         Tenant   @relation(fields: [tenantId], references: [id])
  sequenceNumber Int      // compteur monotonique par tenant
  serviceMode    ServiceMode
  items          Json     // [{productId, name, quantity, priceHt, vatRate, options}]
  totalHt        Int      // centimes
  totalTtc       Int      // centimes
  vatDetails     Json     // [{rate: 10.0, baseHt: 850, amount: 85}]
  payments       Json     // [{method: "cash", amount: 800}, {method: "card", amount: 700}]
  isExpenseNote  Boolean  @default(false) // true = ticket anonymisé note de frais
  hash           String   // SHA-256 du ticket
  prevHash       String   // hash du ticket précédent (chaînage)
  signature      String   // HMAC-SHA256 avec clé tenant
  userId         String?  // caissier qui a encaissé
  createdAt      DateTime @default(now())

  @@unique([tenantId, sequenceNumber])
  @@index([tenantId, createdAt])
}

enum ServiceMode {
  ONSITE
  TAKEAWAY
}

model Closure {
  id       String      @id @default(cuid())
  tenantId String
  tenant   Tenant      @relation(fields: [tenantId], references: [id])
  type     ClosureType
  date     DateTime
  totals   Json        // {totalHt, totalTtc, vatDetails, ticketCount, paymentBreakdown}
  hash     String
  createdAt DateTime   @default(now())

  @@unique([tenantId, type, date])
}

enum ClosureType {
  DAILY
  MONTHLY
  YEARLY
}

model Archive {
  id         String   @id @default(cuid())
  tenantId   String
  tenant     Tenant   @relation(fields: [tenantId], references: [id])
  period     String   // ex: "2026-03", "2026"
  filePath   String
  fileHash   String
  generatedAt DateTime @default(now())
}

model AuditLog {
  id        String   @id @default(cuid())
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  userId    String?
  action    String   // ex: "ticket.create", "product.update", "closure.generate"
  details   Json?
  ip        String?
  createdAt DateTime @default(now())

  @@index([tenantId, createdAt])
}
```

---

## 5. Features Terrain (MVP obligatoire)

### 5.1 Ticket Note de Frais (anonymisé)
- Bouton "Note de frais" sur l'écran de paiement
- Génère un ticket spécial : en-tête commerce (nom, SIRET, adresse) + total TTC + ventilation TVA SANS détail des articles
- Le ticket original complet reste dans le journal ISCA
- Imprimable et envoyable par email
- Champ `isExpenseNote: true` dans le ticket

### 5.2 Paiement Mixte (multi-moyens)
- Écran de paiement avec champs multiples
- Le caissier entre le montant du premier moyen → le reste se calcule automatiquement
- Moyens supportés : espèces, CB, ticket restaurant, chèque
- Le ticket affiche chaque moyen utilisé avec son montant
- Stocké dans `payments: [{method, amount}]`

### 5.3 Split par Article
- Mode "split" sur le panier
- Chaque ligne peut être assignée à un moyen de paiement ou un "groupe de paiement"
- Génère soit un ticket par groupe, soit un ticket unique avec le détail

### 5.4 Sur place / À emporter (TVA différenciée)
- Toggle en haut de l'écran de caisse
- Change automatiquement le taux TVA sur tous les articles :
  - Sur place : 10% (restauration)
  - À emporter : 5.5% (produits alimentaires)
- Le ticket affiche clairement le mode et le taux

### 5.5 Menus Composites
- **Back-office** : le commerçant crée un menu en sélectionnant des articles existants + prix fixe
- **En caisse** : bouton du menu → sélection des variantes (quelle boisson, quelle sauce) → ajout au panier comme 1 item
- PAS de détection automatique de formule. C'est un produit composite simple.

### 5.6 Ticket Production Cuisine
- Quand une commande est validée → ticket envoyé à l'imprimante cuisine
- Contient : numéro de commande, articles, quantités, options/commentaires
- PAS de prix (la cuisine n'a pas besoin de voir les prix)
- Gros caractères lisibles à distance

---

## 6. Phases de Développement

### Phase 1 — Fondations & ISCA (Semaines 1-4)
- Semaine 1 : Setup monorepo, Docker Compose, Prisma, Auth JWT, CI/CD
- Semaines 2-3 : Module ISCA complet (chaînage, signatures, clôtures, export JDC, tests > 95%)
- Semaine 4 : CRUD produits, catégories, menus composites, API REST Swagger

### Phase 2 — Interface de caisse & Features terrain (Semaines 5-8)
- Semaines 5-6 : Écran de caisse (grille produits, panier, toggle sur place/emporter, paiement mixte, split, note de frais)
- Semaine 7 : PWA + mode offline (Service Worker, IndexedDB, sync)
- Semaine 8 : Impression (ticket client, ticket cuisine, note de frais), dashboard basique

### Phase 3 — Production & Lancement (Semaines 9-12)
- Semaine 9 : Sécurité, tests d'intégration, tests de charge, backup
- Semaine 10 : Landing page, onboarding, Stripe, auto-attestation ISCA
- Semaines 11-12 : Déploiement prod, bêta test, lancement

---

## 7. Règles de Code

- **TypeScript strict** partout (`strict: true`, no `any`)
- **Montants en centimes** (Int) pour éviter les erreurs de floating point. 8.50€ = 850
- **Tous les prix stockés en HT**, le TTC est calculé dynamiquement
- **Pas de suppression de données** dans les tables fiscales (tickets, closures, audit_log). Soft delete uniquement pour produits/catégories via le champ `active`
- **Tests** : Vitest pour les tests unitaires, supertest pour les tests d'API
- **Commits conventionnels** : feat:, fix:, chore:, docs:
- **ESLint + Prettier** configurés
- Chaque feature dans une **branche dédiée** + PR

---

## 8. Commande de Démarrage

Commence par le setup du monorepo et l'infrastructure de base (Phase 1, Semaine 1). Ensuite on attaquera le module ISCA.

Quand tu proposes du code, privilégie toujours :
1. La conformité fiscale ISCA (c'est non négociable)
2. La simplicité (pas d'over-engineering, on est solo)
3. La scalabilité (multi-tenant dès le départ)
4. Les types stricts (TypeScript)
