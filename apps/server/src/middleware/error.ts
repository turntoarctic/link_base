/** 统一错误处理（07 §4）：AppError → 结构化响应；ZodError → 400；其余 → 500 只记日志 */
import type { ErrorHandler } from 'hono'
import { ZodError } from 'zod'
import type { AppEnv } from '../lib/context.ts'
import { AppError } from '../lib/errors.ts'
import { logger } from '../lib/logger.ts'

export const errorHandler: ErrorHandler<AppEnv> = (err, c) => {
  if (err instanceof AppError) {
    if (err.status >= 500) {
      logger.error({ err, code: err.code }, 'app error')
    }
    return c.json(
      { error: { code: err.code, message: err.message, details: err.details } },
      err.status as 400,
    )
  }
  if (err instanceof ZodError) {
    return c.json(
      {
        error: { code: 'LB_VALIDATION', message: 'validation failed', details: err.issues },
      },
      400,
    )
  }
  logger.error({ err }, 'unhandled error')
  return c.json(
    { error: { code: 'LB_INTERNAL', message: 'internal error' } },
    500,
  )
}
