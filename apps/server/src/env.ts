/** 环境变量（07 §2）：Bun.env 读取 + Zod 校验，失败即退出。变量唯一清单见 11 §3。 */
import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().optional(),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET 至少 16 字节'),
  APP_ORIGIN: z.string().optional(),
  FRONTEND_URL: z.string().optional(),
  PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
})

const parsed = envSchema.safeParse(Bun.env)
if (!parsed.success) {
  console.error('[env] 环境变量校验失败：', parsed.error.issues)
  process.exit(1)
}

export const env = parsed.data
export type Env = typeof env
