/**
 * zValidator 薄封装（07 §1 / 10 §1）：校验失败统一 400 LB_VALIDATION 响应结构。
 * 保持 zValidator 的泛型推断（c.req.valid('json') 拿到 schema 推导类型）。
 */
import { zValidator } from '@hono/zod-validator'
import type { ValidationTargets } from 'hono'
import type { z } from 'zod'

export function validate<T extends keyof ValidationTargets, S extends z.ZodType>(
  target: T,
  schema: S,
) {
  return zValidator(target, schema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: { code: 'LB_VALIDATION', message: 'validation failed', details: result.error.issues },
        },
        400,
      )
    }
  })
}
