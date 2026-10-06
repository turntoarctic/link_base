/** 搜索（10 §7）：GET /api/workspaces/:wsId/search?q= */
import { Hono } from 'hono'
import { searchQuerySchema } from '@linkbase/contracts'
import type { AppEnv } from '../lib/context.ts'
import { requireAuth } from '../middleware/auth.ts'
import { requireMember } from '../middleware/workspace.ts'
import { validate } from '../lib/validate.ts'
import type { ServerDeps } from '../lib/deps.ts'
import { searchPages } from '../services/search.service.ts'

export function searchRouter(deps: ServerDeps): Hono<AppEnv> {
  return new Hono<AppEnv>()
    .use('/:wsId/search', requireAuth, requireMember)
    .get('/:wsId/search', validate('query', searchQuerySchema), async (c) => {
      const { q } = c.req.valid('query')
      return c.json(await searchPages(deps.db, c.get('ws').id, q), 200)
    })
}
