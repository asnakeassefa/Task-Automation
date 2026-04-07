import Fastify from 'fastify';
import fastifyBasicAuth from '@fastify/basic-auth';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/dist/queueAdapters/bullMQ.js';
import { FastifyAdapter } from '@bull-board/fastify';
import { Queue } from 'bullmq';
import { config } from './config/index.js';
import { startPoller, stopPoller } from './ingestion/poller.js';
import { startWorker, stopWorker } from './queue/worker.js';
import { closeProducer } from './queue/producer.js';
import { redis, closeDedup } from './dedup/redis.js';
import { logger } from './logger.js';

const log = logger.child({ component: 'server' });

async function buildServer() {
  const app = Fastify({ logger: false });

  // --- Health endpoint ---
  app.get('/health', async (_req, reply) => {
    const status: Record<string, boolean> = { redis: false, asana: false };

    try {
      await redis.ping();
      status.redis = true;
    } catch { /* leave false */ }

    try {
      const { ApiClient, UsersApi } = await import('asana');
      const client = ApiClient.instance;
      client.authentications['token'].accessToken = config.asanaAccessToken;
      const usersApi = new UsersApi();
      await usersApi.getUser('me', {});
      status.asana = true;
    } catch { /* leave false */ }

    const ok = status.redis && status.asana;
    reply.code(ok ? 200 : 503).send({ status: ok ? 'ok' : 'degraded', ...status });
  });

  // --- Bull Board (basic-auth protected) ---
  await app.register(fastifyBasicAuth, {
    validate: async (username, password, _req, _reply) => {
      if (username !== config.bullBoardUser || password !== config.bullBoardPass) {
        throw new Error('Unauthorized');
      }
    },
    authenticate: true,
  });

  const emailQueue = new Queue('email-tasks', { connection: { url: config.redisUrl } });
  const serverAdapter = new FastifyAdapter();
  createBullBoard({ queues: [new BullMQAdapter(emailQueue)], serverAdapter });
  serverAdapter.setBasePath('/admin/queues');

  await app.register(serverAdapter.registerPlugin(), { prefix: '/admin/queues' });
  app.addHook('onRequest', async (req, reply) => {
    if (req.url.startsWith('/admin/queues')) {
      await (app as any).basicAuth(req, reply);
    }
  });

  return { app, emailQueue };
}

async function shutdown(app: Awaited<ReturnType<typeof buildServer>>['app'], emailQueue: Queue): Promise<void> {
  log.info('Shutting down...');
  stopPoller();
  await stopWorker();
  await closeProducer();
  await emailQueue.close();
  await closeDedup();
  await app.close();
  log.info('Goodbye');
  process.exit(0);
}

async function main(): Promise<void> {
  log.info('Starting email-to-asana automation...');

  const { app, emailQueue } = await buildServer();

  startWorker();
  await startPoller();

  await app.listen({ port: config.port, host: '0.0.0.0' });
  log.info({ port: config.port }, `HTTP server listening on :${config.port}`);
  log.info(`Bull Board UI at http://localhost:${config.port}/admin/queues`);
  log.info('Running. Press Ctrl+C to stop.\n');

  const handle = () => shutdown(app, emailQueue);
  process.on('SIGINT', handle);
  process.on('SIGTERM', handle);
}

main().catch((err) => {
  log.fatal({ err }, 'Fatal error');
  process.exit(1);
});
