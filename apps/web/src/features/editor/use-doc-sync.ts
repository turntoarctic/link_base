/** 文档推送状态绑定（05 §3.2）：push 失败（离线）时顶栏徽标可见 */
import { useSyncExternalStore } from 'react'
import { isPushFailed, subscribeDocSync } from './doc-manager'

export function useDocPushFailed(pageId: string): boolean {
  return useSyncExternalStore(subscribeDocSync, () => isPushFailed(pageId))
}
