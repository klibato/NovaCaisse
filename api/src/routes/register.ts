import type { FastifyInstance } from 'fastify';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';

const registerSchema = {
  body: {
    type: 'object' as const,
    required: ['name', 'slug', 'email', 'address', 'siret', 'pinCode'],
    properties: {
      name: { type: 'string' as const, minLength: 2, maxLength: 100 },
      slug: {
        type: 'string' as const,
        minLength: 3,
        maxLength: 50,
        pattern: '^[a-z0-9][a-z0-9-]*[a-z0-9]$',
      },
      email: { type: 'string' as const, format: 'email' },
      address: { type: 'string' as const, minLength: 5, maxLength: 255 },
      siret: {
        type: 'string' as const,
        minLength: 14,
        maxLength: 14,
        pattern: '^[0-9]{14}$',
      },
      phone: { type: 'string' as const },
      pinCode: {
        type: 'string' as const,
        minLength: 4,
        maxLength: 6,
        pattern: '^[0-9]+$',
      },
      ownerName: { type: 'string' as const, minLength: 2, maxLength: 100 },
      ownerEmail: { type: 'string' as const, format: 'email' },
    },
  },
};

const checkSlugSchema = {
  querystring: {
    type: 'object' as const,
    required: ['slug'],
    properties: {
      slug: {
        type: 'string' as const,
        minLength: 3,
        maxLength: 50,
        pattern: '^[a-z0-9][a-z0-9-]*[a-z0-9]$',
      },
    },
  },
};

const RESERVED_SLUGS = ['www', 'app', 'api', 'admin', 'demo', 'test', 'staging', 'mail', 'ftp', 'docs'];

export default async function registerRoutes(fastify: FastifyInstance) {
  // Check if slug is available
  fastify.get(
    '/tenants/check-slug',
    { schema: checkSlugSchema },
    async (request, reply) => {
      const { slug } = request.query as { slug: string };

      if (RESERVED_SLUGS.includes(slug)) {
        return reply.send({ available: false, reason: 'Ce sous-domaine est reserve.' });
      }

      const existing = await fastify.prisma.tenant.findUnique({
        where: { slug },
        select: { id: true },
      });

      return reply.send({
        available: !existing,
        reason: existing ? 'Ce sous-domaine est deja pris.' : undefined,
      });
    }
  );

  // Register new tenant
  fastify.post(
    '/tenants/register',
    { schema: registerSchema },
    async (request, reply) => {
      const body = request.body as {
        name: string;
        slug: string;
        email: string;
        address: string;
        siret: string;
        phone?: string;
        pinCode: string;
        ownerName?: string;
        ownerEmail?: string;
      };

      // Check reserved slugs
      if (RESERVED_SLUGS.includes(body.slug)) {
        return reply.status(400).send({ error: 'Ce sous-domaine est reserve.' });
      }

      // Check slug uniqueness
      const existingSlug = await fastify.prisma.tenant.findUnique({
        where: { slug: body.slug },
        select: { id: true },
      });
      if (existingSlug) {
        return reply.status(409).send({ error: 'Ce sous-domaine est deja pris.' });
      }

      // Check SIRET uniqueness
      const existingSiret = await fastify.prisma.tenant.findUnique({
        where: { siret: body.siret },
        select: { id: true },
      });
      if (existingSiret) {
        return reply.status(409).send({ error: 'Ce SIRET est deja enregistre.' });
      }

      // Generate tenant HMAC secret for ISCA
      const tenantSecret = randomBytes(32).toString('hex');

      // Hash the PIN
      const hashedPin = await argon2.hash(body.pinCode);

      // Create tenant + owner in a transaction
      const result = await fastify.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            name: body.name,
            slug: body.slug,
            email: body.email,
            address: body.address,
            siret: body.siret,
            phone: body.phone ?? null,
            tenantSecret,
          },
        });

        const owner = await tx.user.create({
          data: {
            tenantId: tenant.id,
            name: body.ownerName || body.name,
            email: body.ownerEmail || body.email,
            pinCode: hashedPin,
            role: 'OWNER',
          },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            tenantId: tenant.id,
            userId: owner.id,
            action: 'tenant.register',
            details: { slug: tenant.slug, email: tenant.email },
            ip: request.ip,
          },
        });

        return { tenant, owner };
      });

      // TODO: Send welcome email (placeholder)
      fastify.log.info(
        { tenantId: result.tenant.id, slug: result.tenant.slug },
        'New tenant registered'
      );

      return reply.status(201).send({
        tenant: {
          id: result.tenant.id,
          name: result.tenant.name,
          slug: result.tenant.slug,
          email: result.tenant.email,
        },
        owner: {
          id: result.owner.id,
          name: result.owner.name,
          role: result.owner.role,
        },
        loginUrl: `https://${result.tenant.slug}.novacaisse.fr/login`,
      });
    }
  );
}
