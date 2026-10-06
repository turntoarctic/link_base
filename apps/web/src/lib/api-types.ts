/** API 客户端的类型聚合（10 响应形状）：请求/响应 schema 在 @linkbase/contracts，领域 DTO 在 @linkbase/types */
export type {
  AuthSuccess,
  CreatePageInput,
  CreateTagInput,
  LoginInput,
  PatchPageInput,
  PatchUserInput,
  RegisterInput,
} from '@linkbase/contracts'
export type { MemberDto } from '@linkbase/types'

export interface InviteInfo {
  workspaceName: string
  inviterName: string
  expiresAt: string
}
