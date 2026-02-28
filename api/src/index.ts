import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import prismaPlugin from './plugins/prisma.js';
import redisPlugin from './plugins/redis.js';
import authPlugin from './plugins/auth.js';
import tenantPlugin from './plugins/tenant.js';
import authRoutes from './routes/auth.js';
import ticketRoutes from './routes/tickets.js';
import productRoutes from './routes/products.js';
import categoryRoutes from './routes/categories.js';
import menuRoutes from './routes/menus.js';
import closureRoutes from './routes/closures.js';
import { setupClosureJobs } from './jobs/closures.job.js';

const envToLogger: Record<string, object | boolean> = {
  development: {
    transport: {
      target: 'pino-pretty',
      options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' },
    },
  },
  production: true,
  test: false,
};

export async function buildApp() {
  const app = Fastify({
    logger: envToLogger[process.env.NODE_ENV ?? 'development'] ?? true,
  });

  // --- Plugins ---
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  });

  await app.register(helmet, {
    contentSecurityPolicy: false, // Disabled for Swagger UI
  });

  await app.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'dev-secret-change-in-prod',
  });

  await app.register(cookie);

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'NovaCaisse API',
        description: 'API de caisse enregistreuse conforme ISCA',
        version: '0.1.0',
      },
      servers: [
        { url: `http://localhost:${process.env.PORT ?? 4000}` },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
  });

  // --- Custom Plugins ---
  await app.register(prismaPlugin);
  await app.register(redisPlugin);
  await app.register(authPlugin);
  await app.register(tenantPlugin);

  // --- Routes ---
  await app.register(authRoutes);
  await app.register(ticketRoutes);
  await app.register(productRoutes);
  await app.register(categoryRoutes);
  await app.register(menuRoutes);
  await app.register(closureRoutes);

  // --- Health Check ---
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  return app;
}

async function start() {
  const app = await buildApp();
  const port = parseInt(process.env.PORT ?? '4000', 10);
  const host = '0.0.0.0';

  try {
    await app.listen({ port, host });
    app.log.info(`Server running at http://${host}:${port}`);
    app.log.info(`Swagger docs at http://${host}:${port}/docs`);

    // --- BullMQ: Clôture journalière automatique ---
    try {
      const { queue, worker } = await setupClosureJobs(app.redis, app.prisma);
      app.log.info('BullMQ daily-closure job scheduled');

      app.addHook('onClose', async () => {
        await worker.close();
        await queue.close();
      });
    } catch (err) {
      app.log.warn({ err }, 'BullMQ closure jobs setup failed (non-fatal)');
    }
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
