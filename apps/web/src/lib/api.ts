/** 类型化 API 客户端（10 全部端点；类型来自 @linkbase/contracts 与 @linkbase/types） */
import type {
  AuthSuccess,
  CreatePageInput,
  CreateTagInput,
  InviteInfo,
  LoginInput,
  MemberDto,
  PatchPageInput,
  PatchUserInput,
  RegisterInput,
} from './api-types.ts'
import type {
  CommentAnchor,
  CommentItem,
  NotificationItem,
  PageMetaDto,
  PageTreeNode,
  SearchResultItem,
  TagDto,
  TrashItem,
  VersionItem,
} from '@linkbase/types'
import { api } from './fetch.ts'

export type { AuthSuccess }

export interface WorkspaceBrief {
  id: string
  name: string
  role: 'owner' | 'admin' | 'member'
}

export interface MeResponse {
  user: { id: string; email: string; name: string; avatarUrl: string | null; locale: string | null }
  workspaces: WorkspaceBrief[]
}

export const authApi = {
  async register(input: RegisterInput): Promise<AuthSuccess> {
    return api.rawJson<AuthSuccess>('/auth/register', { method: 'POST', body: JSON.stringify(input), skipRefresh: true })
  },
  async login(input: LoginInput): Promise<AuthSuccess> {
    return api.rawJson<AuthSuccess>('/auth/login', { method: 'POST', body: JSON.stringify(input), skipRefresh: true })
  },
  async logout(refreshToken: string): Promise<void> {
    try {
      await api.rawJson<undefined>('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) })
    } catch {
      // 登出失败不阻塞本地清理
    }
  },
  async me(): Promise<MeResponse> {
    return api.json<MeResponse>('/auth/me')
  },
  patchMe(input: PatchUserInput): Promise<MeResponse['user']> {
    return api.json('/users/me', { method: 'PATCH', json: input })
  },
}

export const workspaceApi = {
  list(): Promise<WorkspaceBrief[]> {
    return api.json('/workspaces')
  },
  get(wsId: string): Promise<{ id: string; name: string; avatarUrl: string | null; memberCount: number }> {
    return api.json(`/workspaces/${wsId}`)
  },
  patch(wsId: string, input: { name?: string }): Promise<void> {
    return api.json(`/workspaces/${wsId}`, { method: 'PATCH', json: input })
  },
  members(wsId: string): Promise<MemberDto[]> {
    return api.json(`/workspaces/${wsId}/members`)
  },
  invite(wsId: string): Promise<{ inviteUrl: string; expiresAt: string }> {
    return api.json(`/workspaces/${wsId}/invite`, { method: 'POST', json: {} })
  },
  transfer(wsId: string, toUserId: string): Promise<void> {
    return api.json(`/workspaces/${wsId}/transfer`, { method: 'POST', json: { toUserId } })
  },
  setRole(wsId: string, userId: string, role: string): Promise<void> {
    return api.json(`/workspaces/${wsId}/members/${userId}`, { method: 'PATCH', json: { role } })
  },
  removeMember(wsId: string, userId: string): Promise<void> {
    return api.json(`/workspaces/${wsId}/members/${userId}`, { method: 'DELETE' })
  },
  inviteInfo(token: string): Promise<InviteInfo> {
    return api.json(`/invites/${token}`)
  },
  acceptInvite(token: string): Promise<void> {
    return api.json(`/invites/${token}/accept`, { method: 'POST' })
  },
}

export const pageApi = {
  tree(wsId: string): Promise<PageTreeNode[]> {
    return api.json(`/workspaces/${wsId}/pages`)
  },
  create(wsId: string, input: CreatePageInput): Promise<PageMetaDto> {
    return api.json(`/workspaces/${wsId}/pages`, { method: 'POST', json: input })
  },
  get(wsId: string, pageId: string): Promise<PageMetaDto> {
    return api.json(`/workspaces/${wsId}/pages/${pageId}`)
  },
  patch(wsId: string, pageId: string, input: PatchPageInput): Promise<void> {
    return api.json(`/workspaces/${wsId}/pages/${pageId}`, { method: 'PATCH', json: input })
  },
  trash(wsId: string, pageId: string): Promise<void> {
    return api.json(`/workspaces/${wsId}/pages/${pageId}`, { method: 'DELETE' })
  },
  permanentDelete(wsId: string, pageId: string): Promise<void> {
    return api.json(`/workspaces/${wsId}/pages/${pageId}?permanent=true`, { method: 'DELETE' })
  },
  restore(wsId: string, pageId: string): Promise<void> {
    return api.json(`/workspaces/${wsId}/pages/${pageId}/restore`, { method: 'POST' })
  },
  trashList(wsId: string): Promise<TrashItem[]> {
    return api.json(`/workspaces/${wsId}/trash`)
  },
  templates(wsId: string): Promise<Array<{ id: string; title: string }>> {
    return api.json(`/workspaces/${wsId}/templates`)
  },
  // 版本历史（08 §4.5，T2.3）
  versions(wsId: string, pageId: string): Promise<VersionItem[]> {
    return api.json(`/workspaces/${wsId}/pages/${pageId}/versions`)
  },
  saveVersion(wsId: string, pageId: string): Promise<{ version: number }> {
    return api.json(`/workspaces/${wsId}/pages/${pageId}/versions`, { method: 'POST' })
  },
  versionText(wsId: string, pageId: string, version: number): Promise<{ text: string }> {
    return api.json(`/workspaces/${wsId}/pages/${pageId}/versions/${version}`)
  },
  restoreVersion(wsId: string, pageId: string, version: number): Promise<void> {
    return api.json(`/workspaces/${wsId}/pages/${pageId}/versions/${version}/restore`, { method: 'POST' })
  },
  // Markdown 导入导出（05 §7 / T2.5）
  exportMarkdown(wsId: string, pageId: string): Promise<string> {
    return api.text(`/workspaces/${wsId}/pages/${pageId}/export`)
  },
  importMarkdown(wsId: string, input: { title?: string; markdown: string }): Promise<{ id: string; title: string }> {
    return api.json(`/workspaces/${wsId}/pages/import`, { method: 'POST', json: input })
  },
  // 评论（P1-3 / T2.4）
  comments(wsId: string, pageId: string): Promise<CommentItem[]> {
    return api.json(`/workspaces/${wsId}/pages/${pageId}/comments`)
  },
  createComment(wsId: string, pageId: string, input: { body: string; anchor?: CommentAnchor }): Promise<CommentItem> {
    return api.json(`/workspaces/${wsId}/pages/${pageId}/comments`, { method: 'POST', json: input })
  },
  replyComment(wsId: string, pageId: string, commentId: string, body: string): Promise<CommentItem> {
    return api.json(`/workspaces/${wsId}/pages/${pageId}/comments/${commentId}/replies`, { method: 'POST', json: { body } })
  },
  resolveComment(wsId: string, pageId: string, commentId: string, resolved: boolean): Promise<void> {
    return api.json(`/workspaces/${wsId}/pages/${pageId}/comments/${commentId}/resolve`, { method: 'POST', json: { resolved } })
  },
  editComment(wsId: string, pageId: string, commentId: string, body: string): Promise<void> {
    return api.json(`/workspaces/${wsId}/pages/${pageId}/comments/${commentId}`, { method: 'PATCH', json: { body } })
  },
  deleteComment(wsId: string, pageId: string, commentId: string): Promise<void> {
    return api.json(`/workspaces/${wsId}/pages/${pageId}/comments/${commentId}`, { method: 'DELETE' })
  },
  favorite(wsId: string, pageId: string): Promise<void> {
    return api.json(`/workspaces/${wsId}/pages/${pageId}/favorite`, { method: 'PUT' })
  },
  unfavorite(wsId: string, pageId: string): Promise<void> {
    return api.json(`/workspaces/${wsId}/pages/${pageId}/favorite`, { method: 'DELETE' })
  },
  favorites(wsId: string): Promise<PageMetaDto[]> {
    return api.json(`/workspaces/${wsId}/favorites`)
  },
  visit(wsId: string, pageId: string): Promise<void> {
    return api.json(`/workspaces/${wsId}/pages/${pageId}/visit`, { method: 'PUT' })
  },
  recents(wsId: string): Promise<PageMetaDto[]> {
    return api.json(`/workspaces/${wsId}/recents`)
  },
}

export const tagApi = {
  list(wsId: string): Promise<TagDto[]> {
    return api.json(`/workspaces/${wsId}/tags`)
  },
  create(wsId: string, input: CreateTagInput): Promise<TagDto> {
    return api.json(`/workspaces/${wsId}/tags`, { method: 'POST', json: input })
  },
  remove(wsId: string, tagId: string): Promise<void> {
    return api.json(`/workspaces/${wsId}/tags/${tagId}`, { method: 'DELETE' })
  },
  pageTags(wsId: string, pageId: string): Promise<TagDto[]> {
    return api.json(`/workspaces/${wsId}/pages/${pageId}/tags`)
  },
  addTag(wsId: string, pageId: string, tagId: string): Promise<void> {
    return api.json(`/workspaces/${wsId}/pages/${pageId}/tags/${tagId}`, { method: 'PUT' })
  },
  removeTag(wsId: string, pageId: string, tagId: string): Promise<void> {
    return api.json(`/workspaces/${wsId}/pages/${pageId}/tags/${tagId}`, { method: 'DELETE' })
  },
}

export const searchApi = {
  search(wsId: string, q: string, signal?: AbortSignal): Promise<SearchResultItem[]> {
    return api.json(`/workspaces/${wsId}/search?q=${encodeURIComponent(q)}`, { signal })
  },
}

export const blobApi = {
  upload(wsId: string, file: File): Promise<{ id: string; mime: string; size: number }> {
    return api.upload(`/workspaces/${wsId}/blobs`, file)
  },
  url(id: string): string {
    return `/api/blobs/${id}`
  },
}

export const notificationApi = {
  list(): Promise<NotificationItem[]> {
    return api.json('/notifications')
  },
  markRead(id: string): Promise<void> {
    return api.json(`/notifications/${id}/read`, { method: 'POST' })
  },
  markAllRead(): Promise<void> {
    return api.json('/notifications/read-all', { method: 'POST' })
  },
}
