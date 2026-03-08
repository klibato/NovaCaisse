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
import subdomainPlugin from './plugins/subdomain.js';
import authRoutes from './routes/auth.js';
import ticketRoutes from './routes/tickets.js';
import productRoutes from './routes/products.js';
import categoryRoutes from './routes/categories.js';
import menuRoutes from './routes/menus.js';
import closureRoutes from './routes/closures.js';
import dashboardRoutes from './routes/dashboard.js';
import userRoutes from './routes/users.js';
import settingsRoutes from './routes/settings.js';
import registerRoutes from './routes/register.js';
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

  const isProd = process.env.NODE_ENV === 'production';

  // --- Plugins ---

  // CORS: strict in production, permissive in dev
  await app.register(cors, {
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: string | boolean) => void) => {
      if (!origin) return cb(null, true);
      if (isProd) {
        // Production: only *.novacaisse.fr
        if (
          origin === 'https://novacaisse.fr' ||
          origin.match(/^https:\/\/[\w-]+\.novacaisse\.fr$/)
        ) {
          return cb(null, origin);
        }
        cb(new Error('CORS not allowed'), false);
      } else {
        // Dev: localhost
        if (
          origin === 'http://localhost:3000' ||
          origin.match(/^http:\/\/[\w-]+\.localhost:3000$/)
        ) {
          return cb(null, origin);
        }
        cb(new Error('CORS not allowed'), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  });

  // Helmet: security headers
  await app.register(helmet, {
    contentSecurityPolicy: isProd
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'", 'https://api.novacaisse.fr'],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            frameSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            upgradeInsecureRequests: [],
          },
        }
      : false, // Disabled in dev for Swagger UI
    crossOriginEmbedderPolicy: isProd,
    crossOriginOpenerPolicy: isProd ? { policy: 'same-origin' as const } : false,
    crossOriginResourcePolicy: isProd ? { policy: 'same-origin' as const } : false,
  });

  // JWT: enforce strong secret in production
  const jwtSecret = process.env.JWT_SECRET ?? '';
  if (isProd && jwtSecret.length < 64) {
    throw new Error('JWT_SECRET must be at least 64 characters in production');
  }
  await app.register(jwt, {
    secret: jwtSecret || 'dev-secret-change-in-prod',
  });

  await app.register(cookie);

  // Rate limiting: global 100 req/min per IP
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
  await app.register(subdomainPlugin);

  // --- Routes ---

  // Auth routes with stricter rate limiting on login (5 req/min per IP)
  await app.register(async function authScope(instance) {
    await instance.register(rateLimit, {
      max: 5,
      timeWindow: '1 minute',
      keyGenerator: (req) => req.ip,
    });
    await instance.register(authRoutes);
  });

  await app.register(ticketRoutes);
  await app.register(productRoutes);
  await app.register(categoryRoutes);
  await app.register(menuRoutes);
  await app.register(closureRoutes);
  await app.register(dashboardRoutes);
  await app.register(userRoutes);
  await app.register(settingsRoutes);

  // Public registration route (rate-limited: 10 req/min)
  await app.register(async function registerScope(instance) {
    await instance.register(rateLimit, {
      max: 10,
      timeWindow: '1 minute',
      keyGenerator: (req) => req.ip,
    });
    await instance.register(registerRoutes);
  });

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
