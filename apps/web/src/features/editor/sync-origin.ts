/** 远端回放标记（05 §3.2）：update 回调里据此区分本地/远程，REST 推送与 WS 回发都跳过它 */
export const remoteOrigin = { source: 'linkbase-remote' } as const
export type RemoteOrigin = typeof remoteOrigin
