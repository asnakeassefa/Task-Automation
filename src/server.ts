import { startPoller, stopPoller } from './ingestion/poller.js';
import { startWorker, stopWorker } from './queue/worker.js';
import { closeDedup } from './dedup/redis.js';
import { closeProducer } from './queue/producer.js';

async function shutdown(): Promise<void> {
  console.log('\n[server] Shutting down...');
  stopPoller();
  await stopWorker();
  await closeProducer();
  await closeDedup();
  console.log('[server] Goodbye');
  process.exit(0);
}

async function main(): Promise<void> {
  console.log('[server] Starting email-to-asana automation...');

  startWorker();
  await startPoller();

  console.log('[server] Running. Press Ctrl+C to stop.\n');
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

main().catch((err) => {
  console.error('[server] Fatal error:', err);
  process.exit(1);
});
