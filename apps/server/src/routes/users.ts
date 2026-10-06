/** /api/users/*（10 §2.1） */
import { Hono } from 'hono'
import { patchUserSchema } from '@linkbase/contracts'
import type { AppEnv } from '../lib/context.ts'
import { validate } from '../lib/validate.ts'
import { requireAuth } from '../middleware/auth.ts'
import type { ServerDeps } from '../lib/deps.ts'
import { createAuthService } from '../services/auth.service.ts'

export function usersRouter(deps: ServerDeps): Hono<AppEnv> {
  const auth = createAuthService(deps.db, deps.sessions)
  return new Hono<AppEnv>()
    .use('/me', requireAuth)
    .patch('/me', validate('json', patchUserSchema), async (c) => {
      const user = await auth.patchMe(c.get('user').id, c.req.valid('json'))
      return c.json(user, 200)
    })
}
