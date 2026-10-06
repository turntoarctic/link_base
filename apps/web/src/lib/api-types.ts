/** API 客户端的补充 DTO（10 响应形状；请求 schema 在 @linkbase/contracts） */
export interface InviteInfo {
  workspaceName: string
  inviterName: string
  expiresAt: string
}
