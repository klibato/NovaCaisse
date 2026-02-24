import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ─── Tenant ───
  const tenant = await prisma.tenant.upsert({
    where: { siret: '12345678901234' },
    update: {},
    create: {
      name: 'Kebab du Coin',
      siret: '12345678901234',
      address: '12 Rue de la Paix, 75001 Paris',
      email: 'contact@kebabducoin.fr',
      phone: '01 23 45 67 89',
      tenantSecret: 'dev-tenant-secret-change-in-prod',
      subscriptionPlan: 'starter',
    },
  });
  console.log(`Tenant created: ${tenant.name} (${tenant.id})`);

  // ─── Users ───
  const ownerPin = await argon2.hash('1234');
  const managerPin = await argon2.hash('5678');
  const cashierPin = await argon2.hash('0000');

  const owner = await prisma.user.upsert({
    where: { tenantId_pinCode: { tenantId: tenant.id, pinCode: ownerPin } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Ali Kebab',
      pinCode: ownerPin,
      role: 'OWNER',
    },
  });
  console.log(`User created: ${owner.name} (${owner.role})`);

  const manager = await prisma.user.upsert({
    where: { tenantId_pinCode: { tenantId: tenant.id, pinCode: managerPin } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Marie Dupont',
      pinCode: managerPin,
      role: 'MANAGER',
    },
  });
  console.log(`User created: ${manager.name} (${manager.role})`);

  const cashier = await prisma.user.upsert({
    where: { tenantId_pinCode: { tenantId: tenant.id, pinCode: cashierPin } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Jean Martin',
      pinCode: cashierPin,
      role: 'CASHIER',
    },
  });
  console.log(`User created: ${cashier.name} (${cashier.role})`);

  // ─── Categories ───
  const categories = await Promise.all([
    prisma.category.create({
      data: {
        tenantId: tenant.id,
        name: 'Tacos',
        color: '#e74c3c',
        position: 0,
      },
    }),
    prisma.category.create({
      data: {
        tenantId: tenant.id,
        name: 'Burgers',
        color: '#e67e22',
        position: 1,
      },
    }),
    prisma.category.create({
      data: {
        tenantId: tenant.id,
        name: 'Boissons',
        color: '#3498db',
        position: 2,
      },
    }),
    prisma.category.create({
      data: {
        tenantId: tenant.id,
        name: 'Desserts',
        color: '#2ecc71',
        position: 3,
      },
    }),
  ]);

  const [tacos, burgers, boissons, desserts] = categories;
  console.log(`Categories created: ${categories.map((c) => c.name).join(', ')}`);

  // ─── Products ───
  const products = await Promise.all([
    prisma.product.create({
      data: {
        tenantId: tenant.id,
        name: 'Tacos Classique',
        priceHt: 750,
        vatRate: 10.0,
        categoryId: tacos.id,
        supplements: [
          { name: 'Fromage', priceHt: 100, maxQty: 3 },
          { name: 'Sauce Algérienne', priceHt: 0, maxQty: 1 },
        ],
      },
    }),
    prisma.product.create({
      data: {
        tenantId: tenant.id,
        name: 'Tacos Maxi',
        priceHt: 950,
        vatRate: 10.0,
        categoryId: tacos.id,
      },
    }),
    prisma.product.create({
      data: {
        tenantId: tenant.id,
        name: 'Burger Classic',
        priceHt: 850,
        vatRate: 10.0,
        categoryId: burgers.id,
      },
    }),
    prisma.product.create({
      data: {
        tenantId: tenant.id,
        name: 'Coca-Cola 33cl',
        priceHt: 250,
        vatRate: 5.5,
        categoryId: boissons.id,
      },
    }),
    prisma.product.create({
      data: {
        tenantId: tenant.id,
        name: 'Eau 50cl',
        priceHt: 150,
        vatRate: 5.5,
        categoryId: boissons.id,
      },
    }),
    prisma.product.create({
      data: {
        tenantId: tenant.id,
        name: 'Tiramisu',
        priceHt: 400,
        vatRate: 10.0,
        categoryId: desserts.id,
      },
    }),
  ]);

  const [tacosClassique, , , cocaCola, eau] = products;
  console.log(`Products created: ${products.map((p) => p.name).join(', ')}`);

  // ─── Menu ───
  const menu = await prisma.menu.create({
    data: {
      tenantId: tenant.id,
      name: 'Menu Tacos',
      priceHt: 1050,
      vatRate: 10.0,
      categoryId: tacos.id,
      items: {
        create: [
          {
            productId: tacosClassique.id,
            isChoice: false,
            position: 0,
          },
          {
            productId: cocaCola.id,
            isChoice: true,
            choiceGroup: 'boisson',
            position: 1,
          },
          {
            productId: eau.id,
            isChoice: true,
            choiceGroup: 'boisson',
            position: 2,
          },
        ],
      },
    },
    include: { items: true },
  });
  console.log(`Menu created: ${menu.name} with ${menu.items.length} items`);

  console.log('Seeding complete!');
}

main()
  .catch((e: unknown) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
