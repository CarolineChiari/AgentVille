#!/usr/bin/env node
// `npm run serve`: the built app from dist/ plus the API, on loopback unless told otherwise.
import { createServer } from './index.mjs'

const { ready } = createServer({
  port: Number(process.env.PORT) || 5274,
  host: process.env.AGENTVILLE_HOST || '127.0.0.1',
})
ready.catch((err) => {
  console.error(err.message)
  process.exit(1)
})
