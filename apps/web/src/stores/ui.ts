/** UI 偏好（06 §3）：主题（亮/暗/系统）与侧边栏折叠，localStorage 持久化 */
import { create } from 'zustand'

export type ThemeMode = 'light' | 'dark' | 'system'

const UI_STORAGE_KEY = 'linkbase.ui'

interface UiPrefs {
  theme: ThemeMode
  sidebarCollapsed: boolean
}

function load(): UiPrefs {
  try {
    const raw = localStorage.getItem(UI_STORAGE_KEY)
    if (raw) return { theme: 'system', sidebarCollapsed: false, ...(JSON.parse(raw) as Partial<UiPrefs>) }
  } catch {
    // ignore
  }
  return { theme: 'system', sidebarCollapsed: false }
}

function persist(prefs: UiPrefs): void {
  localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(prefs))
}

interface UiState extends UiPrefs {
  setTheme: (theme: ThemeMode) => void
  toggleSidebar: () => void
}

export const useUiStore = create<UiState>((set, get) => ({
  ...load(),
  setTheme: (theme) => {
    set({ theme })
    persist(get())
    applyTheme(theme)
  },
  toggleSidebar: () => {
    set({ sidebarCollapsed: !get().sidebarCollapsed })
    persist(get())
  },
}))

/** 应用主题：class="dark" 切换 + system 跟随 matchMedia */
export function applyTheme(theme: ThemeMode): void {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const dark = theme === 'dark' || (theme === 'system' && media.matches)
  document.documentElement.classList.toggle('dark', dark)
}

/** 启动时应用并监听系统变化 */
export function initTheme(): void {
  applyTheme(useUiStore.getState().theme)
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    applyTheme(useUiStore.getState().theme)
  })
}
