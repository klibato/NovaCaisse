import type { FastifyInstance, FastifyRequest } from 'fastify';
import * as argon2 from 'argon2';
import { randomBytes, randomUUID } from 'crypto';
import rateLimit from '@fastify/rate-limit';
import { sendVerificationEmail, sendWelcomeEmail } from '../services/email.service.js';

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

const resendVerificationSchema = {
  body: {
    type: 'object' as const,
    required: ['email'],
    properties: {
      email: { type: 'string' as const, format: 'email' },
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

      // Generate email verification token
      const emailVerificationToken = randomUUID();
      const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

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
            emailVerified: false,
            emailVerificationToken,
            emailVerificationExpires,
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

      // Send verification email (fire-and-forget, don't block response)
      sendVerificationEmail(body.email, body.name, emailVerificationToken).catch((err) => {
        fastify.log.error({ err, tenantId: result.tenant.id }, 'Failed to send verification email');
      });

      fastify.log.info(
        { tenantId: result.tenant.id, slug: result.tenant.slug },
        'New tenant registered — verification email sent'
      );

      return reply.status(201).send({
        success: true,
        message: 'Un email de verification a ete envoye a votre adresse.',
        tenant: {
          id: result.tenant.id,
          name: result.tenant.name,
          slug: result.tenant.slug,
          email: result.tenant.email,
        },
      });
    }
  );

  // Verify email
  fastify.get(
    '/verify-email',
    async (request, reply) => {
      const { token } = request.query as { token?: string };

      if (!token) {
        return reply.status(400).send({ error: 'Token manquant.', code: 'MISSING_TOKEN' });
      }

      const tenant = await fastify.prisma.tenant.findUnique({
        where: { emailVerificationToken: token },
        include: {
          users: {
            where: { role: 'OWNER' },
            select: { name: true, email: true },
            take: 1,
          },
        },
      });

      if (!tenant) {
        return reply.status(400).send({ error: 'Lien invalide ou expire.', code: 'INVALID_TOKEN' });
      }

      if (tenant.emailVerificationExpires && tenant.emailVerificationExpires < new Date()) {
        return reply.status(400).send({ error: 'Ce lien a expire. Veuillez en demander un nouveau.', code: 'TOKEN_EXPIRED' });
      }

      if (tenant.emailVerified) {
        return reply.redirect(`https://${tenant.slug}.novacaisse.fr/login?verified=true`);
      }

      // Activate
      await fastify.prisma.tenant.update({
        where: { id: tenant.id },
        data: {
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationExpires: null,
        },
      });

      await fastify.prisma.auditLog.create({
        data: {
          tenantId: tenant.id,
          action: 'tenant.email_verified',
          details: { email: tenant.email },
          ip: request.ip,
        },
      });

      // Send welcome email
      const owner = tenant.users[0];
      if (owner) {
        sendWelcomeEmail(
          owner.email || tenant.email,
          tenant.name,
          tenant.slug,
          owner.name,
        ).catch((err) => {
          fastify.log.error({ err, tenantId: tenant.id }, 'Failed to send welcome email');
        });
      }

      return reply.redirect(`https://${tenant.slug}.novacaisse.fr/login?verified=true`);
    }
  );

  // Resend verification email (rate-limited: 3/hour)
  fastify.register(async function resendScope(instance) {
    await instance.register(rateLimit, {
      max: 3,
      timeWindow: '1 hour',
      keyGenerator: (req: FastifyRequest) => req.ip,
    });

    instance.post(
      '/resend-verification',
      { schema: resendVerificationSchema },
      async (request, reply) => {
        const { email } = request.body as { email: string };

        const tenant = await fastify.prisma.tenant.findFirst({
          where: { email, emailVerified: false },
        });

        // Always return success to avoid leaking which emails exist
        if (!tenant) {
          return reply.send({ success: true, message: 'Si cette adresse est associee a un compte, un email a ete envoye.' });
        }

        // Generate new token
        const emailVerificationToken = randomUUID();
        const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await fastify.prisma.tenant.update({
          where: { id: tenant.id },
          data: { emailVerificationToken, emailVerificationExpires },
        });

        sendVerificationEmail(email, tenant.name, emailVerificationToken).catch((err) => {
          fastify.log.error({ err, tenantId: tenant.id }, 'Failed to resend verification email');
        });

        return reply.send({ success: true, message: 'Si cette adresse est associee a un compte, un email a ete envoye.' });
      }
    );
  });
}
