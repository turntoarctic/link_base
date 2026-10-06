/**
 * 待办列表输入规则（05 §6 承诺 `[ ] `；starter-kit/TaskItem 均不自带）：
 * 行首输入 `[ ]`/`[x]`/`[X]` + 空格，把当前空段落转为待办列表项。
 */
import { Extension } from '@tiptap/core'
import { InputRule } from '@tiptap/core'

export const TaskListInputRule = Extension.create({
  name: 'taskListInputRule',

  addInputRules() {
    return [
      new InputRule({
        find: /^\[( |x|X)\]\s$/,
        handler: ({ state, range, chain, match }) => {
          if (state.doc.childCount === 0) return null
          const checked = match[1] !== ' '
          chain().deleteRange(range).toggleTaskList().updateAttributes('taskItem', { checked }).run()
          return null
        },
      }),
    ]
  },
})
