/** /api/auth/*（10 §2）：注册（3/h）与登录（5/min）更严限流 */
import { Hono } from 'hono'
import { loginSchema, refreshSchema, registerSchema } from '@linkbase/contracts'
import type { AppEnv } from '../lib/context.ts'
import { validate } from '../lib/validate.ts'
import { requireAuth } from '../middleware/auth.ts'
import { rateLimit } from '../middleware/rate-limit.ts'
import type { ServerDeps } from '../lib/deps.ts'
import { createAuthService } from '../services/auth.service.ts'

export function authRouter(deps: ServerDeps): Hono<AppEnv> {
  const auth = createAuthService(deps.db, deps.sessions)

  return new Hono<AppEnv>()
    .post(
      '/register',
      rateLimit(deps.kv, { prefix: 'register', windowSec: 3600, max: 3 }),
      validate('json', registerSchema),
      async (c) => {
        const result = await auth.register(c.req.valid('json'))
        return c.json(result, 201)
      },
    )
    .post(
      '/login',
      rateLimit(deps.kv, { prefix: 'login', windowSec: 60, max: 5 }),
      validate('json', loginSchema),
      async (c) => {
        const result = await auth.login(c.req.valid('json'))
        return c.json(result, 200)
      },
    )
    .post('/refresh', validate('json', refreshSchema), async (c) => {
      const { refreshToken } = c.req.valid('json')
      const result = await auth.refresh(refreshToken)
      return c.json(result, 200)
    })
    .post('/logout', validate('json', refreshSchema), async (c) => {
      const { refreshToken } = c.req.valid('json')
      await auth.logout(refreshToken)
      return c.body(null, 204)
    })
    .get('/me', requireAuth, async (c) => {
      const result = await auth.me(c.get('user').id)
      return c.json(result, 200)
    })
}
