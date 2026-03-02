import type { FastifyInstance } from 'fastify';
import * as argon2 from 'argon2';

export default async function userRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  // GET /users — liste les users du tenant (OWNER/MANAGER uniquement)
  fastify.get('/users', async (request, reply) => {
    if (request.user.role === 'CASHIER') {
      return reply.status(403).send({ error: 'Accès refusé', code: 'FORBIDDEN' });
    }

    const users = await fastify.prisma.user.findMany({
      where: { tenantId: request.user.tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return reply.send(users);
  });

  // POST /users — créer un user
  fastify.post('/users', async (request, reply) => {
    if (request.user.role === 'CASHIER') {
      return reply.status(403).send({ error: 'Accès refusé', code: 'FORBIDDEN' });
    }

    const body = request.body as {
      name: string;
      pinCode: string;
      role: 'OWNER' | 'MANAGER' | 'CASHIER';
      email?: string;
    };

    if (!body.name || !body.pinCode || !body.role) {
      return reply.status(400).send({ error: 'Champs requis : name, pinCode, role', code: 'MISSING_FIELDS' });
    }

    if (!/^[0-9]{4,6}$/.test(body.pinCode)) {
      return reply.status(400).send({ error: 'Le PIN doit contenir 4 à 6 chiffres', code: 'INVALID_PIN' });
    }

    // Role permission checks
    if (body.role === 'OWNER' || body.role === 'MANAGER') {
      if (request.user.role !== 'OWNER') {
        return reply.status(403).send({ error: 'Seul un OWNER peut créer des MANAGER ou OWNER', code: 'FORBIDDEN' });
      }
    }

    // Verify PIN is not already used in this tenant
    const existingUsers = await fastify.prisma.user.findMany({
      where: { tenantId: request.user.tenantId },
    });

    for (const existing of existingUsers) {
      try {
        if (await argon2.verify(existing.pinCode, body.pinCode)) {
          return reply.status(409).send({ error: 'Ce PIN est déjà utilisé par un autre utilisateur', code: 'PIN_TAKEN' });
        }
      } catch {
        // Invalid hash, skip
      }
    }

    const hashedPin = await argon2.hash(body.pinCode);

    const user = await fastify.prisma.user.create({
      data: {
        tenantId: request.user.tenantId,
        name: body.name,
        pinCode: hashedPin,
        role: body.role,
        email: body.email || null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
      },
    });

    await fastify.prisma.auditLog.create({
      data: {
        tenantId: request.user.tenantId,
        userId: request.user.userId,
        action: 'user.create',
        details: { createdUserId: user.id, role: user.role },
        ip: request.ip,
      },
    });

    return reply.status(201).send(user);
  });

  // PUT /users/:id — modifier nom, email, role
  fastify.put('/users/:id', async (request, reply) => {
    if (request.user.role === 'CASHIER') {
      return reply.status(403).send({ error: 'Accès refusé', code: 'FORBIDDEN' });
    }

    const { id } = request.params as { id: string };
    const body = request.body as { name?: string; email?: string; role?: 'OWNER' | 'MANAGER' | 'CASHIER' };

    const existing = await fastify.prisma.user.findFirst({
      where: { id, tenantId: request.user.tenantId },
    });

    if (!existing) {
      return reply.status(404).send({ error: 'Utilisateur non trouvé', code: 'NOT_FOUND' });
    }

    // Only OWNER can change to/from MANAGER/OWNER roles
    if (body.role && (body.role === 'OWNER' || body.role === 'MANAGER' || existing.role === 'OWNER' || existing.role === 'MANAGER')) {
      if (request.user.role !== 'OWNER') {
        return reply.status(403).send({ error: 'Seul un OWNER peut modifier les rôles MANAGER/OWNER', code: 'FORBIDDEN' });
      }
    }

    const user = await fastify.prisma.user.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.email !== undefined && { email: body.email || null }),
        ...(body.role !== undefined && { role: body.role }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
      },
    });

    return reply.send(user);
  });

  // PATCH /users/:id/pin — changer le PIN
  fastify.patch('/users/:id/pin', async (request, reply) => {
    if (request.user.role === 'CASHIER') {
      return reply.status(403).send({ error: 'Accès refusé', code: 'FORBIDDEN' });
    }

    const { id } = request.params as { id: string };
    const body = request.body as { newPin: string };

    if (!body.newPin || !/^[0-9]{4,6}$/.test(body.newPin)) {
      return reply.status(400).send({ error: 'Le PIN doit contenir 4 à 6 chiffres', code: 'INVALID_PIN' });
    }

    const existing = await fastify.prisma.user.findFirst({
      where: { id, tenantId: request.user.tenantId },
    });

    if (!existing) {
      return reply.status(404).send({ error: 'Utilisateur non trouvé', code: 'NOT_FOUND' });
    }

    // Verify new PIN is not already used
    const allUsers = await fastify.prisma.user.findMany({
      where: { tenantId: request.user.tenantId, id: { not: id } },
    });

    for (const u of allUsers) {
      try {
        if (await argon2.verify(u.pinCode, body.newPin)) {
          return reply.status(409).send({ error: 'Ce PIN est déjà utilisé par un autre utilisateur', code: 'PIN_TAKEN' });
        }
      } catch {
        // skip
      }
    }

    const hashedPin = await argon2.hash(body.newPin);

    await fastify.prisma.user.update({
      where: { id },
      data: { pinCode: hashedPin },
    });

    return reply.send({ success: true });
  });

  // PATCH /users/:id/toggle — activer/désactiver
  fastify.patch('/users/:id/toggle', async (request, reply) => {
    if (request.user.role === 'CASHIER') {
      return reply.status(403).send({ error: 'Accès refusé', code: 'FORBIDDEN' });
    }

    const { id } = request.params as { id: string };

    const existing = await fastify.prisma.user.findFirst({
      where: { id, tenantId: request.user.tenantId },
    });

    if (!existing) {
      return reply.status(404).send({ error: 'Utilisateur non trouvé', code: 'NOT_FOUND' });
    }

    const user = await fastify.prisma.user.update({
      where: { id },
      data: { active: !existing.active },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
      },
    });

    return reply.send(user);
  });

  // DELETE /users/:id — suppression définitive
  fastify.delete('/users/:id', async (request, reply) => {
    if (request.user.role === 'CASHIER') {
      return reply.status(403).send({ error: 'Accès refusé', code: 'FORBIDDEN' });
    }

    const { id } = request.params as { id: string };

    if (id === request.user.userId) {
      return reply.status(400).send({ error: 'Vous ne pouvez pas vous supprimer vous-même', code: 'SELF_DELETE' });
    }

    const existing = await fastify.prisma.user.findFirst({
      where: { id, tenantId: request.user.tenantId },
    });

    if (!existing) {
      return reply.status(404).send({ error: 'Utilisateur non trouvé', code: 'NOT_FOUND' });
    }

    await fastify.prisma.user.delete({ where: { id } });

    await fastify.prisma.auditLog.create({
      data: {
        tenantId: request.user.tenantId,
        userId: request.user.userId,
        action: 'user.delete',
        details: { deletedUserId: id, deletedUserName: existing.name },
        ip: request.ip,
      },
    });

    return reply.status(204).send();
  });
}
