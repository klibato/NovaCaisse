import type { FastifyInstance } from 'fastify';
import * as argon2 from 'argon2';

const loginSchema = {
  body: {
    type: 'object' as const,
    required: ['pinCode'],
    properties: {
      pinCode: { type: 'string' as const, minLength: 4, maxLength: 6, pattern: '^[0-9]+$' },
      tenantId: { type: 'string' as const },
    },
  },
  response: {
    200: {
      type: 'object' as const,
      properties: {
        token: { type: 'string' as const },
        refreshToken: { type: 'string' as const },
        user: {
          type: 'object' as const,
          properties: {
            id: { type: 'string' as const },
            name: { type: 'string' as const },
            role: { type: 'string' as const },
            tenantId: { type: 'string' as const },
          },
        },
      },
    },
  },
};

const refreshSchema = {
  body: {
    type: 'object' as const,
    required: ['refreshToken'],
    properties: {
      refreshToken: { type: 'string' as const },
    },
  },
};

export default async function authRoutes(fastify: FastifyInstance) {
  // POST /auth/login
  fastify.post('/auth/login', { schema: loginSchema }, async (request, reply) => {
    const { pinCode, tenantId } = request.body as { pinCode: string; tenantId?: string };

    // Find all active users (optionally filtered by tenant)
    const whereClause: Record<string, unknown> = { active: true };
    if (tenantId) {
      whereClause.tenantId = tenantId;
    }

    const users = await fastify.prisma.user.findMany({
      where: whereClause,
      include: { tenant: { select: { active: true } } },
    });

    // Check PIN against each user (argon2 verify)
    let matchedUser = null;
    for (const user of users) {
      if (!user.tenant.active) continue;
      try {
        if (await argon2.verify(user.pinCode, pinCode)) {
          matchedUser = user;
          break;
        }
      } catch {
        // Invalid hash format, skip
      }
    }

    if (!matchedUser) {
      return reply.status(401).send({ error: 'PIN incorrect', code: 'INVALID_PIN' });
    }

    const payload = {
      userId: matchedUser.id,
      tenantId: matchedUser.tenantId,
      role: matchedUser.role,
      name: matchedUser.name,
    };

    const token = fastify.jwt.sign(payload, { expiresIn: '8h' });
    const refreshToken = fastify.jwt.sign(
      { userId: matchedUser.id, tenantId: matchedUser.tenantId, type: 'refresh' },
      { expiresIn: '7d' },
    );

    // Audit log
    await fastify.prisma.auditLog.create({
      data: {
        tenantId: matchedUser.tenantId,
        userId: matchedUser.id,
        action: 'auth.login',
        details: { role: matchedUser.role },
        ip: request.ip,
      },
    });

    return reply.send({
      token,
      refreshToken,
      user: {
        id: matchedUser.id,
        name: matchedUser.name,
        role: matchedUser.role,
        tenantId: matchedUser.tenantId,
      },
    });
  });

  // POST /auth/refresh
  fastify.post('/auth/refresh', { schema: refreshSchema }, async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken: string };

    try {
      const decoded = fastify.jwt.verify<{
        userId: string;
        tenantId: string;
        type: string;
      }>(refreshToken);

      if (decoded.type !== 'refresh') {
        return reply.status(401).send({ error: 'Token invalide', code: 'INVALID_TOKEN' });
      }

      const user = await fastify.prisma.user.findFirst({
        where: { id: decoded.userId, tenantId: decoded.tenantId, active: true },
        include: { tenant: { select: { active: true } } },
      });

      if (!user || !user.tenant.active) {
        return reply.status(401).send({ error: 'Utilisateur non trouvé', code: 'USER_NOT_FOUND' });
      }

      const payload = {
        userId: user.id,
        tenantId: user.tenantId,
        role: user.role,
        name: user.name,
      };

      const token = fastify.jwt.sign(payload, { expiresIn: '8h' });
      const newRefreshToken = fastify.jwt.sign(
        { userId: user.id, tenantId: user.tenantId, type: 'refresh' },
        { expiresIn: '7d' },
      );

      return reply.send({ token, refreshToken: newRefreshToken });
    } catch {
      return reply.status(401).send({ error: 'Token expiré ou invalide', code: 'INVALID_TOKEN' });
    }
  });

  // GET /auth/me
  fastify.get(
    '/auth/me',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = await fastify.prisma.user.findFirst({
        where: {
          id: request.user.userId,
          tenantId: request.user.tenantId,
          active: true,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          tenantId: true,
          createdAt: true,
          tenant: {
            select: {
              name: true,
              siret: true,
              address: true,
            },
          },
        },
      });

      if (!user) {
        return reply.status(404).send({ error: 'Utilisateur non trouvé', code: 'USER_NOT_FOUND' });
      }

      return reply.send(user);
    },
  );
}
