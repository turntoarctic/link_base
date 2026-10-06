/** 编辑器视图（05）：createEditor 装配 + BubbleMenu；宿主桥（上传/导航/建子页）注入 */
import { useRef } from 'react'
import { useNavigate } from 'react-router'
import { useEditor, EditorContent } from '@tiptap/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createEditor, EditorBubbleToolbar, type MentionUser } from '@linkbase/editor'
import * as Y from 'yjs'
import { blobApi, pageApi, workspaceApi } from '@/lib/api'
import { insertSubpageNode } from './doc-manager'

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

  const editor = useEditor(
    () =>
      createEditor({
        ydoc,
        uploadImage: async (file) => {
          const blob = await blobApi.upload(wsId, file)
          return { url: blobApi.url(blob.id) }
        },
        members: () => membersRef.current,
        onSubpageOpen: (targetPageId) => navigate(`/${wsId}/page/${targetPageId}`),
        createSubpage: async () => {
          const page = await pageApi.create(wsId, {})
          await insertSubpageNode(wsId, pageId, page.id, page.title)
          void queryClient.invalidateQueries({ queryKey: ['pages', wsId] })
          return { pageId: page.id, title: page.title }
        },
        pickImage: () => pickFile('image/*'),
      }),
    [ydoc, wsId, pageId],
  )

  if (!editor) return null
  return (
    <>
      <EditorContent editor={editor} />
      <EditorBubbleToolbar editor={editor} />
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
