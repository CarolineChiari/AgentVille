import { defineConfig } from 'vite'
import { createApiMiddleware } from './server/api.mjs'

/** Serves /api from inside the Vite dev server, so `npm run dev` is the whole app. */
const api = () => ({
  name: 'agentville-api',
  configureServer(server) {
    server.middlewares.use(createApiMiddleware())
  },
})

export default defineConfig({
  plugins: [api()],
  // PORT lets a second copy run alongside the first. Loopback only: the API reads your
  // session transcripts and can ask the OS to open things.
  server: { host: '127.0.0.1', port: Number(process.env.PORT) || 5274, strictPort: false },
  build: { target: 'esnext' },
})
