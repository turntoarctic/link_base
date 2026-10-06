/** 会话 store（06 §3）：token 持久化在 localStorage（经 lib/fetch），这里放当前用户 */
import { create } from 'zustand'

export interface SessionUser {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  locale: string | null
}

interface AuthState {
  user: SessionUser | null
  setUser: (user: SessionUser | null) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}))
