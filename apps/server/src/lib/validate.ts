/**
 * zValidator 包装（07 §1）：统一 400 LB_VALIDATION 响应结构（10 §1）。
 */
import { zValidator } from '@hono/zod-validator'
import type { ValidationTargets } from 'hono'
import type { AppEnv } from '../lib/context.ts'

export function validate<T extends keyof ValidationTargets, S>(target: T, schema: S) {
  return zValidator(target, schema as never, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: {
            code: 'LB_VALIDATION',
            message: 'validation failed',
            details: result.error.issues,
          },
        },
        400,
      ) as never
    }
    return undefined as never
  }) as unknown as ReturnType<
    typeof zValidator<ValidationTargets[T], never, never, never, AppEnv['Variables']>
  >
}
