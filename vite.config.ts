import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import generate from './api/generate.js';
import verify from './api/verify.js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  if (!process.env.GROQ_API_KEY && env.GROQ_API_KEY) process.env.GROQ_API_KEY = env.GROQ_API_KEY;
  return {
    server: { port: 3000, host: '0.0.0.0' },
    plugins: [react(), {
      name: 'local-ai-api',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const route = req.url?.split('?')[0];
          if (route !== '/api/generate' && route !== '/api/verify') return next();
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(Buffer.from(chunk));
          const response = Object.assign(res, {
            status(code: number) { res.statusCode = code; return response; },
            json(value: unknown) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); return response; }
          });
          const request = Object.assign(req, { body: Buffer.concat(chunks).toString() });
          await (route === '/api/verify' ? verify : generate)(request, response);
        });
      }
    }],
    resolve: { alias: { '@': path.resolve('.') } }
  };
});
