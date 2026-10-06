/**
 * 页内查找替换（P1-7 / ⌘F）：插件高亮全部匹配（普通 + 当前），
 * 命令：setSearch / findNext / findPrev / replaceCurrent / replaceAll。
 * 匹配在全文索引上做（大小写不敏感），跨块匹配以选择语义处理（替换会并块，符合直觉）。
 */
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { TextSelection } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as ProsemirrorNode } from '@tiptap/pm/model'

export interface SearchMatch {
  from: number
  to: number
}

interface SearchState {
  searchTerm: string
  replaceTerm: string
  matches: SearchMatch[]
  active: number
}

export const findReplaceKey = new PluginKey<SearchState>('linkbaseFindReplace')

interface TextChunk {
  start: number
  pos: number
  text: string
}

function buildIndex(doc: ProsemirrorNode): { full: string; chunks: TextChunk[] } {
  let full = ''
  const chunks: TextChunk[] = []
  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      chunks.push({ start: full.length, pos, text: node.text })
      full += node.text
    }
    return true
  })
  return { full, chunks }
}

function indexToPos(chunks: TextChunk[], idx: number): number {
  for (let i = chunks.length - 1; i >= 0; i--) {
    const c = chunks[i]!
    if (idx >= c.start) return c.pos + (idx - c.start)
  }
  return 1
}

function findMatches(doc: ProsemirrorNode, term: string): SearchMatch[] {
  if (!term.trim()) return []
  const { full, chunks } = buildIndex(doc)
  const hay = full.toLowerCase()
  const needle = term.toLowerCase()
  const out: SearchMatch[] = []
  let idx = hay.indexOf(needle)
  while (idx !== -1 && out.length < 500) {
    const from = indexToPos(chunks, idx)
    const to = indexToPos(chunks, idx + needle.length)
    if (to > from) out.push({ from, to })
    idx = hay.indexOf(needle, idx + Math.max(1, needle.length))
  }
  return out
}

function stateFrom(doc: ProsemirrorNode, prev: SearchState): SearchState {
  return { ...prev, matches: findMatches(doc, prev.searchTerm), active: 0 }
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    findReplace: {
      setSearch: (opts: { searchTerm: string; replaceTerm?: string }) => ReturnType
      findNext: () => ReturnType
      findPrev: () => ReturnType
      replaceCurrent: () => ReturnType
      replaceAll: () => ReturnType
    }
  }
}

export const FindReplace = Extension.create({
  name: 'findReplace',

  addCommands() {
    return {
      setSearch:
        (opts: { searchTerm: string; replaceTerm?: string }) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(findReplaceKey, { type: 'set', searchTerm: opts.searchTerm, replaceTerm: opts.replaceTerm ?? '' })
          }
          return true
        },
      findNext:
        () =>
        ({ state, dispatch }) => {
          const s = findReplaceKey.getState(state)
          if (!s || s.matches.length === 0) return false
          const next = s.active + 1 >= s.matches.length ? 0 : s.active + 1
          if (dispatch) {
            const m = s.matches[next]!
            dispatch(state.tr.setMeta(findReplaceKey, { type: 'active', active: next }).setSelection(TextSelection.create(state.doc, m.from, m.to)).scrollIntoView())
          }
          return true
        },
      findPrev:
        () =>
        ({ state, dispatch }) => {
          const s = findReplaceKey.getState(state)
          if (!s || s.matches.length === 0) return false
          const prev = s.active - 1 < 0 ? s.matches.length - 1 : s.active - 1
          if (dispatch) {
            const m = s.matches[prev]!
            dispatch(state.tr.setMeta(findReplaceKey, { type: 'active', active: prev }).setSelection(TextSelection.create(state.doc, m.from, m.to)).scrollIntoView())
          }
          return true
        },
      replaceCurrent:
        () =>
        ({ state, dispatch }) => {
          const s = findReplaceKey.getState(state)
          if (!s || s.matches.length === 0) return false
          const m = s.matches[Math.min(s.active, s.matches.length - 1)]!
          if (dispatch) dispatch(state.tr.insertText(s.replaceTerm, m.from, m.to))
          return true
        },
      replaceAll:
        () =>
        ({ state, dispatch }) => {
          const s = findReplaceKey.getState(state)
          if (!s || s.matches.length === 0) return false
          if (dispatch) {
            // 自尾向头替换，位置不漂移
            let tr = state.tr
            for (let i = s.matches.length - 1; i >= 0; i--) {
              const m = s.matches[i]!
              tr = tr.insertText(s.replaceTerm, m.from, m.to)
            }
            dispatch(tr)
          }
          return true
        },
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<SearchState>({
        key: findReplaceKey,
        state: {
          init: (_, state) => stateFrom(state.doc, { searchTerm: '', replaceTerm: '', matches: [], active: 0 }),
          apply: (tr, prev) => {
            const meta = tr.getMeta(findReplaceKey) as
              | { type: 'set'; searchTerm: string; replaceTerm: string }
              | { type: 'active'; active: number }
              | undefined
            if (meta?.type === 'set') {
              const next = { ...prev, searchTerm: meta.searchTerm, replaceTerm: meta.replaceTerm }
              return stateFrom(tr.doc, next)
            }
            if (meta?.type === 'active') return { ...prev, active: meta.active }
            if (tr.docChanged) return stateFrom(tr.doc, prev) // 编辑后匹配随文档重算
            return prev
          },
        },
        props: {
          decorations(state) {
            const s = findReplaceKey.getState(state)
            if (!s || s.matches.length === 0) return DecorationSet.empty
            const decorations = s.matches.map((m, i) =>
              Decoration.inline(m.from, m.to, {
                class: i === s.active ? 'linkbase-search-match linkbase-search-match-active' : 'linkbase-search-match',
              }),
            )
            return DecorationSet.create(state.doc, decorations)
          },
        },
      }),
    ]
  },
})
