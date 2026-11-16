import 'dotenv/config';
import { serve } from '@hono/node-server';
import { env } from './env.js';
import app from './app.js';

serve(
  {
    fetch: app.fetch,
    port: env.serverPort,
  },
  (info) => {
    console.log(`cuotas-club API escuchando en http://localhost:${info.port}`);
  },
);
