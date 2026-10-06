/** 编辑器视图（05）：createEditor 装配 + BubbleMenu；宿主桥（上传/导航/建子页）注入。
 * 注意：tiptap React 绑定（useEditor/EditorContent）经 @linkbase/editor 再导出使用，
 * web 不得直接 import @tiptap/*（跨上下文双实例 → schema 缺 doc，已实测踩坑）。 */
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { buildEditorKit, CodeBlockLangPicker, EditorBubbleToolbar, EditorContent, useEditor, type MentionUser } from '@linkbase/editor'
import type * as Y from 'yjs'
import { blobApi, pageApi, workspaceApi } from '@/lib/api'
import { toast } from '@/components/ui/sonner'
import { useAuthStore } from '@/stores/auth'
import { getPageAwareness, refreshPageDoc } from './doc-manager'

/** 协作光标/头像配色：按用户 id 稳定取色（06 §5.5 头像色系） */
const CARET_PALETTE = ['#e5484d', '#e5762d', '#b08de0', '#2f9e77', '#3b82d0', '#c232ac']

function userColor(id: string): string {
  let hash = 0
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return CARET_PALETTE[hash % CARET_PALETTE.length]!
}

export function EditorView({
  wsId,
  pageId,
  ydoc,
}: {
  wsId: string
  pageId: string
  ydoc: Y.Doc
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t } = useTranslation('editor')

  // @ 提及候选：成员列表异步加载，经 ref 供 suggestion 读取
  const membersRef = useRef<MentionUser[]>([])
  const members = useQuery({
    queryKey: ['members', wsId],
    queryFn: () => workspaceApi.members(wsId),
    staleTime: 60_000,
  })
  if (members.data) {
    membersRef.current = members.data.map((m) => ({
      userId: m.userId,
      label: m.name,
      avatarUrl: m.avatarUrl,
    }))
  }

  // 协作身份（T2.2）：颜色按用户 id 稳定分配；awareness 由 ws-relay 持有（未连 WS 为 null）
  const user = useAuthStore((s) => s.user)
  const awareness = getPageAwareness(pageId)
  const collaborationUser = user ? { name: user.name, color: userColor(user.id) } : undefined
  useEffect(() => {
    if (awareness && collaborationUser) {
      awareness.setLocalStateField('user', collaborationUser)
    }
  }, [awareness, collaborationUser])

  const editor = useEditor({
    extensions: buildEditorKit({
      ydoc,
      uploadImage: async (file) => {
        const blob = await blobApi.upload(wsId, file)
        return { url: blobApi.url(blob.id) }
      },
      members: () => membersRef.current,
      awareness: awareness ? { awareness } : undefined,
      collaborationUser,
      onSubpageOpen: (targetPageId) => navigate(`/${wsId}/page/${targetPageId}`),
      // 服务端直写 parent_id（树即时生效）；卡片由 slash action 在光标处插入（insertSubpage
      // 命令），内容经 Y.Doc push 落库。失败可见（toast），不静默
      createSubpage: async () => {
        try {
          const page = await pageApi.create(wsId, { parentId: pageId })
          void queryClient.invalidateQueries({ queryKey: ['pages', wsId] })
          return { pageId: page.id, title: page.title }
        } catch (error) {
          console.error('[subpage] create failed', error)
          toast.error(t('editor:subpage.createFailed'))
          return null
        }
      },
      pickImage: () => pickFile('image/*'),
    }),
  }, [ydoc, wsId, pageId])

  if (!editor) return null
  return (
    <>
      <EditorContent editor={editor} />
      <EditorBubbleToolbar editor={editor} />
      <CodeBlockLangPicker editor={editor} />
    </>
  )
}

/** 系统文件选择框（slash「图片」入口） */
export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolvePromise) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.style.display = 'none'
    document.body.appendChild(input)
    input.addEventListener('change', () => {
      resolvePromise(input.files?.[0] ?? null)
      input.remove()
    })
    input.addEventListener('cancel', () => {
      resolvePromise(null)
      input.remove()
    })
    input.click()
  })
}
