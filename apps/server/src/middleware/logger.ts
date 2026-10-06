/** 请求日志（07 §3）：每请求 reqId，响应头回传；Pino 结构化输出 */
import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../lib/context.ts'
import { logger } from '../lib/logger.ts'

export const requestLogger = createMiddleware<AppEnv>(async (c, next) => {
  const reqId = crypto.randomUUID()
  const start = performance.now()
  c.header('X-Request-Id', reqId)
  await next()
  const ms = Math.round(performance.now() - start)
  const line = {
    reqId,
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    ms,
  }
  if (c.res.status >= 500) logger.error(line, 'req')
  else if (c.res.status >= 400) logger.warn(line, 'req')
  else logger.info(line, 'req')
})
