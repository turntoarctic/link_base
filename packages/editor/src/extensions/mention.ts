/**
 * @ 提及扩展（05 §6）：插入用户 mention 节点；候选来自宿主注入的工作空间成员列表。
 * 页面引用（mention 指向页面）为 P1 能力（02 §1.3），届时扩展 items 来源即可。
 */
import { Node, mergeAttributes } from '@tiptap/core'
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from '@tiptap/suggestion'
import { MentionPopup } from '../components/mention-popup.tsx'
import { createSuggestionRenderer } from '../components/suggestion.tsx'
import { MENTION_ATTR, NODE_MENTION } from '../schema.ts'

export interface MentionUser {
  userId: string
  label: string
  avatarUrl?: string | null
}

export interface MentionOptions {
  users: () => MentionUser[]
}

const renderer = createSuggestionRenderer<MentionUser>(MentionPopup)

export const Mention = Node.create<MentionOptions>({
  name: NODE_MENTION,

  addOptions() {
    return { users: () => [] }
  },

  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,

  addAttributes() {
    return {
      [MENTION_ATTR.userId]: { default: null },
      [MENTION_ATTR.label]: { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: `span[data-type="${NODE_MENTION}"]` }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-type': NODE_MENTION,
        'data-user-id': node.attrs[MENTION_ATTR.userId],
      }),
      `@${node.attrs[MENTION_ATTR.label] ?? ''}`,
    ]
  },

  renderText({ node }) {
    return `@${node.attrs[MENTION_ATTR.label] ?? ''}`
  },

  addProseMirrorPlugins() {
    return [
      Suggestion<MentionUser>({
        editor: this.editor,
        char: '@',
        items: ({ query }) => {
          const q = query.toLowerCase()
          return this.options
            .users()
            .filter((u) => u.label.toLowerCase().includes(q))
            .slice(0, 8)
        },
        command: ({ editor, range, props }) => {
          editor
            .chain()
            .focus()
            .insertContentAt(range, [
              { type: NODE_MENTION, attrs: { [MENTION_ATTR.userId]: props.userId, [MENTION_ATTR.label]: props.label } },
              { type: 'text', text: ' ' },
            ])
            .run()
        },
        render: () => ({
          onStart: (props: SuggestionProps<MentionUser>) => renderer.onStart(props),
          onUpdate: (props: SuggestionProps<MentionUser>) => renderer.onUpdate(props),
          onExit: () => renderer.onExit(),
          onKeyDown: (props: SuggestionKeyDownProps) => renderer.onKeyDown(props),
        }),
      }),
    ]
  },
})
