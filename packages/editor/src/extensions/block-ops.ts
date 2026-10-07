/**
 * 块级操作扩展（Notion 化 T1）：复制/移动/删除当前顶层块、待办勾选、包裹与解包，
 * 以及 Esc 进入块选择（NodeSelection）后的 ↑↓ 移动 / Enter 进入 / Backspace 删除。
 * 所有命令单事务完成（撤销栈一步）；选区是 view 本地态不进 Y.Doc。
 * 装配序要求：在 SlashMenu/Mention 之后——suggestion 插件先消费 Escape/方向键。
 */
import { Extension } from '@tiptap/core'
import { NodeSelection, TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state'
import { insertPosAtIndex, moveTopLevelBlockTr, topLevelBlockAtSelection, topLevelBlocks } from './block-utils.ts'
import { CALLOUT_ATTR, NODE_CALLOUT } from '../schema.ts'

/** 顶层包裹块（转为目标 = 包裹；反向转为 = 解包取内容） */
const WRAPPER_TYPES = new Set([NODE_CALLOUT, 'details'])

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    blockOps: {
      /** 复制当前顶层块并插到其下方，光标留在原块 */
      duplicateBlock: () => ReturnType
      moveBlockUp: () => ReturnType
      moveBlockDown: () => ReturnType
      /** 光标所在待办翻转勾选（不在 taskItem 内 = 无操作） */
      toggleTaskCheck: () => ReturnType
      /** 选中当前顶层块（Esc 块选择模式） */
      selectCurrentBlock: () => ReturnType
      selectBlockByIndex: (index: number) => ReturnType
      /** 删除当前顶层块；文档仅剩一块时兜底为空段落（TrailingNode 也保证不为空） */
      deleteBlock: () => ReturnType
      /** 当前顶层块包进 callout/details（单事务，绕过 details.isolating） */
      wrapTopLevelBlockIn: (type: 'callout' | 'details') => ReturnType
      /** 解开顶层包裹块（callout/details → 原内容块），details 的 summary 丢弃 */
      unwrapTopLevelBlock: () => ReturnType
    }
  }
}

/** 移动后光标留在被移动块内：文本选区就近吸附，块选区重新选中已移动节点 */
function keepSelectionInMovedBlock(state: EditorState, tr: Transaction, finalIndex: number, bias: 1 | -1): void {
  if (state.selection instanceof NodeSelection) {
    tr.setSelection(NodeSelection.create(tr.doc, insertPosAtIndex(tr.doc, finalIndex)))
  } else {
    const mapped = tr.mapping.map(state.selection.from, bias)
    tr.setSelection(TextSelection.near(tr.doc.resolve(mapped), bias))
  }
}

export const BlockOps = Extension.create({
  name: 'blockOps',

  addCommands() {
    return {
      duplicateBlock:
        () =>
        ({ state, dispatch }) => {
          const block = topLevelBlockAtSelection(state)
          if (!block) return false
          if (dispatch) {
            const node = state.doc.child(block.index)
            const nodeStart = block.pos - 1
            const tr = state.tr.insert(nodeStart + block.size, node)
            // 副本插在原块之后，原选区位置不受影响（就近吸附保光标）
            tr.setSelection(TextSelection.near(tr.doc.resolve(tr.mapping.map(state.selection.from))))
            dispatch(tr)
          }
          return true
        },

      moveBlockUp:
        () =>
        ({ state, dispatch }) => {
          const block = topLevelBlockAtSelection(state)
          if (!block || block.index === 0) return false
          const tr = moveTopLevelBlockTr(state, block.index, block.index - 1)
          if (!tr) return false
          if (dispatch) {
            keepSelectionInMovedBlock(state, tr, block.index - 1, -1)
            dispatch(tr)
          }
          return true
        },

      moveBlockDown:
        () =>
        ({ state, dispatch }) => {
          const block = topLevelBlockAtSelection(state)
          if (!block || block.index >= state.doc.childCount - 1) return false
          const tr = moveTopLevelBlockTr(state, block.index, block.index + 2)
          if (!tr) return false
          if (dispatch) {
            keepSelectionInMovedBlock(state, tr, block.index + 1, 1)
            dispatch(tr)
          }
          return true
        },

      toggleTaskCheck:
        () =>
        ({ state, dispatch }) => {
          const { $from } = state.selection
          for (let d = $from.depth; d > 0; d--) {
            const node = $from.node(d)
            if (node.type.name === 'taskItem') {
              if (dispatch) {
                const checked = !node.attrs.checked
                dispatch(state.tr.setNodeMarkup($from.before(d), undefined, { ...node.attrs, checked }))
              }
              return true
            }
          }
          return false
        },

      selectCurrentBlock:
        () =>
        ({ state, dispatch }) => {
          const block = topLevelBlockAtSelection(state)
          if (!block) return false
          if (dispatch) {
            dispatch(state.tr.setSelection(NodeSelection.create(state.doc, block.pos - 1)))
          }
          return true
        },

      selectBlockByIndex:
        (index: number) =>
        ({ state, dispatch }) => {
          const block = topLevelBlocks(state.doc)[index]
          if (!block) return false
          if (dispatch) {
            dispatch(state.tr.setSelection(NodeSelection.create(state.doc, block.pos - 1)))
          }
          return true
        },

      deleteBlock:
        () =>
        ({ state, dispatch }) => {
          const block = topLevelBlockAtSelection(state)
          if (!block) return false
          if (dispatch) {
            const { tr } = state
            const nodeStart = block.pos - 1
            if (state.doc.childCount === 1) {
              // 不清空文档：唯一块删掉后兜底空段落
              tr.replaceWith(nodeStart, nodeStart + block.size, state.schema.nodes.paragraph.create())
            } else {
              tr.delete(nodeStart, nodeStart + block.size)
            }
            dispatch(tr)
          }
          return true
        },

      wrapTopLevelBlockIn:
        (type: 'callout' | 'details') =>
        ({ state, dispatch }) => {
          const block = topLevelBlockAtSelection(state)
          if (!block) return false
          const node = state.doc.child(block.index)
          if (WRAPPER_TYPES.has(node.type.name)) return false
          if (dispatch) {
            const schema = state.schema
            const wrapper =
              type === NODE_CALLOUT
                ? schema.nodes[NODE_CALLOUT].create({ [CALLOUT_ATTR.icon]: '💡', [CALLOUT_ATTR.color]: 'gray' }, node)
                : schema.nodes.details.create({ open: true }, [schema.nodes.detailsSummary.create(), node])
            const nodeStart = block.pos - 1
            dispatch(state.tr.replaceWith(nodeStart, nodeStart + block.size, wrapper))
          }
          return true
        },

      unwrapTopLevelBlock:
        () =>
        ({ state, dispatch }) => {
          const block = topLevelBlockAtSelection(state)
          if (!block) return false
          const node = state.doc.child(block.index)
          if (!WRAPPER_TYPES.has(node.type.name)) return false
          if (dispatch) {
            // details 丢 summary 取内容块；callout 直接取内容
            const children = node.type.name === 'details' ? node.content.content.slice(1) : node.content.content
            const replacement = children.length > 0 ? children : [state.schema.nodes.paragraph.create()]
            const nodeStart = block.pos - 1
            dispatch(state.tr.replaceWith(nodeStart, nodeStart + block.size, replacement))
          }
          return true
        },
    }
  },

  addKeyboardShortcuts() {
    /** 仅当块选择模式（顶层 NodeSelection）生效，否则放行默认行为 */
    const onTopLevelNodeSelection = (fn: (blockIndex: number, nodeIsAtom: boolean) => boolean) => () => {
      const { state } = this.editor
      const sel = state.selection
      if (!(sel instanceof NodeSelection) || sel.$from.depth !== 0) return false
      const blocks = topLevelBlocks(state.doc)
      const index = blocks.findIndex((b) => b.pos - 1 === sel.from)
      if (index === -1) return false
      return fn(index, sel.node.isAtom)
    }

    return {
      'Mod-d': () => this.editor.commands.duplicateBlock(),
      'Mod-Shift-ArrowUp': () => this.editor.commands.moveBlockUp(),
      'Mod-Shift-ArrowDown': () => this.editor.commands.moveBlockDown(),
      'Mod-Enter': () => this.editor.commands.toggleTaskCheck(),
      'Mod-Shift-Enter': () => this.editor.commands.toggleTaskCheck(),

      // Esc 进入块选择（保守守卫：可编辑 + 空选区 + 未处于块选择；suggestion 弹层的
      // Escape 由其自身插件先消费——本扩展装配在 SlashMenu/Mention 之后）
      Escape: () => {
        const { state } = this.editor
        if (!this.editor.isEditable) return false
        if (!state.selection.empty) return false
        if (state.selection instanceof NodeSelection) return false
        return this.editor.commands.selectCurrentBlock()
      },

      // 块选择模式：↑↓ 移动选中块（首/末块拦下，避免滚动文档）
      ArrowUp: onTopLevelNodeSelection((index) => {
        if (index === 0) return true
        return this.editor.commands.selectBlockByIndex(index - 1)
      }),
      ArrowDown: onTopLevelNodeSelection((index) => {
        if (index >= this.editor.state.doc.childCount - 1) return true
        return this.editor.commands.selectBlockByIndex(index + 1)
      }),

      // 块选择模式：Enter 进入块内（文本块才可进入；atom 放行默认）
      Enter: onTopLevelNodeSelection((_index, nodeIsAtom) => {
        if (nodeIsAtom) return false
        const sel = this.editor.state.selection as NodeSelection
        const tr = this.editor.state.tr.setSelection(TextSelection.near(this.editor.state.doc.resolve(sel.from + 1)))
        this.editor.view.dispatch(tr)
        return true
      }),

      // 块选择模式：Backspace 删除选中块
      Backspace: onTopLevelNodeSelection(() => this.editor.commands.deleteBlock()),
    }
  },
})
