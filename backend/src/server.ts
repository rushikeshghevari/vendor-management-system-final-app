import { createApp } from '@/app';
import { connectDB, disconnectDB } from '@/config/db';
import { env } from '@/config/env';
import { startEscalationScheduler, stopEscalationScheduler } from '@/services/escalation/escalation.service';
import { startQueueProcessor, stopQueueProcessor } from '@/services/push/notificationQueue.service';
import { logger } from '@/utils/logger';

async function main(): Promise<void> {
  await connectDB();

  const app = createApp();
  const server = app.listen(env.port, '0.0.0.0', () => {
    logger.info(`Server listening on 0.0.0.0:${env.port} [${env.nodeEnv}]`);
  });

  startEscalationScheduler();
  startQueueProcessor();

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    stopEscalationScheduler();
    stopQueueProcessor();
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error) => {
  logger.error('Failed to start server', error);
  process.exit(1);
});
