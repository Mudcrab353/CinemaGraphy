// Vercel serverless entrypoint.
//
// Vercel's Node.js runtime accepts a plain Express app as the default
// export of a file under /api and calls it directly as a request handler,
// so this file doesn't need to do anything except build and export the
// exact same `addon` app used by the Docker/VPS entrypoint (index.js) —
// same providers, same routes, same behaviour. No separate code path to
// maintain, nothing that can drift out of sync with the other runtimes.
//
// Provider/logger setup runs once per warm serverless instance (module
// load), then gets reused across invocations — same pattern already used
// for session caching elsewhere in the project (e.g. DigiMovie's login
// cookie).
import {createAddon, createLogger, createProviders} from '../app.js'

const logger = createLogger(process.env)
const providers = createProviders({env: process.env, logger})
const addon = createAddon({env: process.env, logger, providers})

export default addon
