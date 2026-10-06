/** Hono 泛型上下文类型（c.set/c.get 类型安全） */
import type { UserRole } from '@linkbase/types'

export interface AuthUser {
  id: string
  wid?: string
}

export interface WsContext {
  id: string
  role: UserRole
}

export type AppEnv = {
  Variables: {
    user: AuthUser
    ws: WsContext
  }
}
