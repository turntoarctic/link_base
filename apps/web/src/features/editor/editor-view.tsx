/** 编辑器视图（05）：createEditor 装配 + BubbleMenu；宿主桥（上传/导航/建子页）注入。
 * 注意：tiptap React 绑定（useEditor/EditorContent）经 @linkbase/editor 再导出使用，
 * web 不得直接 import @tiptap/*（跨上下文双实例 → schema 缺 doc，已实测踩坑）。 */
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { buildEditorKit, CodeBlockLangPicker, configureBaseBridge, EditorBubbleToolbar, EditorContent, findReplaceKey, refreshComments, useEditor, type CommentAnchorSpec, type MentionUser } from '@linkbase/editor'
import type { CommentAnchor } from '@linkbase/types'
import type * as Y from 'yjs'
import { blobApi, pageApi, workspaceApi } from '@/lib/api'
import { toast } from '@/components/ui/sonner'
import { useAuthStore } from '@/stores/auth'
import { getPageAwareness, insertSubpageNode, refreshPageDoc } from './doc-manager'
import { FindReplaceBar, openFindReplace } from './find-replace-bar'
import { useReducer, useState } from 'react'

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
  commentAnchors,
  onCommentAnchorClick,
  onInlineComment,
}: {
  wsId: string
  pageId: string
  ydoc: Y.Doc
  /** 评论锚点数据源（宿主持有评论查询数据） */
  commentAnchors: CommentAnchorSpec[]
  onCommentAnchorClick?: (id: string) => void
  /** bubble 工具条「评论」：从当前选区捕获锚点后交宿主打开面板 */
  onInlineComment?: (anchor: CommentAnchor | null) => void
}) {
  // 经 ref 供扩展闭包读取，避免 useEditor 依赖随评论数据抖动
  const anchorsRef = useRef<CommentAnchorSpec[]>(commentAnchors)
  anchorsRef.current = commentAnchors
  const onAnchorClickRef = useRef(onCommentAnchorClick)
  onAnchorClickRef.current = onCommentAnchorClick
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

  // Base 桥（T2.8）：行转子页面 = 当前页下建子页 + 卡片插入
  useEffect(() => {
    configureBaseBridge({
      ydoc,
      source: {
        createSubpage: async (title: string) => {
          const page = await pageApi.create(wsId, { parentId: pageId, title: title || undefined })
          await insertSubpageNode(wsId, pageId, page.id, page.title || title)
          void queryClient.invalidateQueries({ queryKey: ['pages', wsId] })
          return { pageId: page.id }
        },
        onOpen: (targetPageId: string) => navigate(`/${wsId}/page/${targetPageId}`),
      },
    })
    return () => configureBaseBridge(null)
  }, [ydoc, wsId, pageId, navigate, queryClient])

  // 子页列表块数据源（T2.7）：树查询数据经由面板查询同源 API
  const subpageListSource = {
    fetchChildren: async (pid: string) => {
      const tree = await pageApi.tree(wsId)
      const stack = [...tree]
      while (stack.length > 0) {
        const n = stack.shift()!
        if (n.id === pid) return n.children.map((c) => ({ id: c.id, title: c.title }))
        stack.push(...n.children)
      }
      return []
    },
    onOpen: (targetPageId: string) => navigate(`/${wsId}/page/${targetPageId}`),
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
      subpageListSource,
      currentPageId: () => pageId,
      getCommentAnchors: () => anchorsRef.current,
      onCommentAnchorClick: (id) => onAnchorClickRef.current?.(id),
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
      // 附件：任意文件 → blobs（内容寻址）→ 卡片节点
      pickAttachment: async () => {
        const file = await pickFile('*/*')
        if (!file) return null
        try {
          const blob = await blobApi.upload(wsId, file)
          return { blobId: blob.id, name: file.name, size: file.size, mime: file.type || 'application/octet-stream' }
        } catch (error) {
          console.error('[attachment] upload failed', error)
          toast.error(t('attachment.uploadFailed'))
          return null
        }
      },
    }),
  }, [ydoc, wsId, pageId])

  // 评论数据变化 → 高亮装饰重算
  useEffect(() => {
    if (editor) refreshComments(editor)
  }, [editor, commentAnchors])

  /** 从当前选区捕获文本引用锚点（quote + 前后文 40 字） */
  const captureInlineComment = () => {
    if (!editor) return
    const { from, to, empty } = editor.state.selection
    let anchor: CommentAnchor | null = null
    if (!empty) {
      const quote = editor.state.doc.textBetween(from, to, ' ')
      if (quote.trim()) {
        anchor = {
          quote,
          prefix: editor.state.doc.textBetween(Math.max(0, from - 40), from, ' '),
          suffix: editor.state.doc.textBetween(to, Math.min(editor.state.doc.content.size, to + 40), ' '),
        }
      }
    }
    onInlineComment?.(anchor)
  }

  // ⌘F（编辑器聚焦时）与 ⋯ 菜单（事件）双入口打开查找替换
  const [, force] = useReducer((x: number) => x + 1, 0)
  const [findOpen, setFindOpen] = useState(false)
  useEffect(() => {
    const open = () => setFindOpen(true)
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        const target = e.target as HTMLElement | null
        if (target?.closest?.('.ProseMirror')) {
          e.preventDefault()
          setFindOpen(true)
        }
      }
    }
    window.addEventListener('linkbase-find-replace', open)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('linkbase-find-replace', open)
      window.removeEventListener('keydown', onKey)
    }
  }, [])
  useEffect(() => {
    if (!editor) return
    const onUpdate = () => force()
    editor.on('transaction', onUpdate)
    return () => {
      editor.off('transaction', onUpdate)
    }
  }, [editor])
  useEffect(() => {
    if (!findOpen && editor) editor.commands.setSearch({ searchTerm: '' })
  }, [findOpen, editor])

  if (!editor) return null
  return (
    <>
      <EditorContent editor={editor} />
      {findOpen && <FindReplaceBar editor={editor} onClose={() => setFindOpen(false)} />}
      <EditorBubbleToolbar editor={editor} onComment={captureInlineComment} />
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
