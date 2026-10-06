/** 在线成员（T2.2）：从页面 awareness 状态聚合他人（光标/头像数据源，09 §6） */
import { useEffect, useState } from 'react'
import { getPageAwareness } from './doc-manager'

export interface OnlineUser {
  clientID: number
  name: string
  color: string
}

export function useAwarenessUsers(pageId: string): OnlineUser[] {
  const [users, setUsers] = useState<OnlineUser[]>([])

  useEffect(() => {
    const awareness = getPageAwareness(pageId)
    if (!awareness) {
      setUsers([])
      return
    }
    const update = () => {
      const out: OnlineUser[] = []
      awareness.getStates().forEach((state, clientID) => {
        const user = (state as { user?: { name: string; color: string } }).user
        if (clientID !== awareness.clientID && user) out.push({ clientID, ...user })
      })
      setUsers(out)
    }
    awareness.on('change', update)
    update()
    return () => {
      awareness.off('change', update)
    }
  }, [pageId])

  return users
}
