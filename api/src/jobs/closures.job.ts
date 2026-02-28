import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import type { PrismaClient } from '@prisma/client';
import { generateClosure } from '../isca/closure.js';

const QUEUE_NAME = 'daily-closure';

/**
 * Configure le job de clôture journalière automatique.
 * Planifié à 00:01 chaque jour pour clôturer la veille.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function setupClosureJobs(redis: any, prisma: PrismaClient): Promise<{ queue: Queue; worker: Worker }> {
  const connection = redis as ConnectionOptions;

  const queue = new Queue(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 200,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    },
  });

  // Supprimer les repeatable jobs existants avant d'en recréer
  const existingJobs = await queue.getRepeatableJobs();
  for (const job of existingJobs) {
    await queue.removeRepeatableByKey(job.key);
  }

  // Planifier à 00:01 chaque jour
  await queue.add(
    'daily-closure',
    {},
    {
      repeat: { pattern: '1 0 * * *' }, // cron: 00:01 chaque jour
    },
  );

  const worker = new Worker(
    QUEUE_NAME,
    async () => {
      // Clôturer la veille pour tous les tenants actifs
      const tenants = await prisma.tenant.findMany({
        where: { active: true },
        select: { id: true },
      });

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      for (const tenant of tenants) {
        try {
          // Vérifier si la clôture existe déjà
          const startOfDay = new Date(
            yesterday.getFullYear(),
            yesterday.getMonth(),
            yesterday.getDate(),
          );

          const existing = await prisma.closure.findUnique({
            where: {
              tenantId_type_date: {
                tenantId: tenant.id,
                type: 'DAILY',
                date: startOfDay,
              },
            },
          });

          if (!existing) {
            await generateClosure(prisma, tenant.id, 'DAILY', yesterday);
          }
        } catch {
          console.error(`Erreur clôture daily pour tenant ${tenant.id}`);
        }
      }
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed:`, err.message);
  });

  return { queue, worker };
}
