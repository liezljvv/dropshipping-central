import 'dotenv/config';
import { defineApiEnv } from '@dropshipping-central/config';
import { createApp } from './app.js';

async function start() {
  const env = defineApiEnv(process.env);
  const app = createApp(env);

  try {
    await app.listen({
      host: '0.0.0.0',
      port: env.API_PORT,
    });
  } catch (error) {
    app.log.error(error);
    process.exitCode = 1;
    await app.close();
  }
}

void start();
