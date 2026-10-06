/**
 * Hono 实例组装（07 §2）：中间件顺序 = 日志 → 安全头 → CORS → 全局限流 → 路由 → 错误兜底。
 * WS（/ws，09）Phase 2 才注册；静态托管由 index.ts 按需挂载。
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { env } from './env.ts'
import type { ServerDeps } from './lib/deps.ts'
import { errorHandler } from './middleware/error.ts'
import { requestLogger } from './middleware/logger.ts'
import { rateLimit } from './middleware/rate-limit.ts'
import { authRouter } from './routes/auth.ts'
import { usersRouter } from './routes/users.ts'
import { invitesRouter, workspacesRouter } from './routes/workspaces.ts'
import { pagesRouter } from './routes/pages.ts'
import { docRouter } from './routes/doc.ts'
import { blobsRouter } from './routes/blobs.ts'
import { searchRouter } from './routes/search.ts'
import { healthRouter } from './routes/health.ts'

export function createApp(deps: ServerDeps): Hono {
  const app = new Hono()

  app.use('*', requestLogger)
  app.use('*', secureHeaders())
  if (env.FRONTEND_URL) {
    app.use(
      '/api/*',
      cors({
        origin: [env.FRONTEND_URL],
        allowHeaders: ['content-type', 'authorization'],
        allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
        maxAge: 86400,
      }),
    )
  }

  // health 不计入全局限流（探活）
  app.route('/api/health', healthRouter(deps))
  app.use('/api/*', rateLimit(deps.kv, { prefix: 'global', windowSec: 15 * 60, max: 100 }))

  app.route('/api/auth', authRouter(deps))
  app.route('/api/users', usersRouter(deps))
  app.route('/api/workspaces', workspacesRouter(deps))
  app.route('/api/invites', invitesRouter(deps))
  app.route('/api/workspaces', pagesRouter(deps))
  app.route('/api/workspaces', docRouter(deps))
  app.route('/api', blobsRouter(deps))
  app.route('/api/workspaces', searchRouter(deps))

  app.onError(errorHandler)
  return app
}
