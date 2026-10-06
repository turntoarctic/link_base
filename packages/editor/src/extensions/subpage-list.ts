/**
 * 子页列表块（P1-7）：动态展示当前页面的子页清单（与散落的 subpage 卡片互补的聚合视图）。
 * 数据源由宿主经 configureSubpageListSource 桥接（编辑器包不感知 API）。
 */
import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { SubpageListView } from '../components/subpage-list-view.tsx'

export interface SubpageListSource {
  fetchChildren: (pageId: string) => Promise<Array<{ id: string; title: string }>>
  onOpen: (pageId: string) => void
}

let subpageListSource: SubpageListSource | null = null

export function configureSubpageListSource(next: SubpageListSource | null): void {
  subpageListSource = next
}

export function getSubpageListSource(): SubpageListSource | null {
  return subpageListSource
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    subpageList: {
      /** 插入子页列表块（聚合展示 pageId 的子页） */
      insertSubpageList: (attrs: { pageId: string | null }) => ReturnType
    }
  }
}

export const SubpageList = Node.create({
  name: 'subpageList',
  group: 'block',
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      pageId: { default: null },
    }
  },

  parseHTML() {
    return [{ tag: `div[data-type="subpageList"]` }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'subpageList' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(SubpageListView)
  },

  addCommands() {
    return {
      insertSubpageList:
        (attrs: { pageId: string | null }) =>
        ({ commands }) =>
          commands.insertContent({ type: 'subpageList', attrs }),
    }
  },
})
