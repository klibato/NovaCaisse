import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Role } from '@prisma/client';

export function rbac(allowedRoles: Role[]) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const userRole = request.user?.role;

    if (!userRole || !allowedRoles.includes(userRole)) {
      reply.status(403).send({
        error: 'Accès interdit',
        code: 'FORBIDDEN',
      });
    }
  };
}
