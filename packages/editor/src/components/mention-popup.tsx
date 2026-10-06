/** @ 提及候选弹层（05 §6：用户搜索下拉） */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { MentionUser } from '../extensions/mention.ts'
import { registerListKeyboardNav, type SuggestionPopupProps } from './suggestion.tsx'

export function MentionPopup({ props, registerKeyDown }: SuggestionPopupProps<MentionUser>) {
  const { t } = useTranslation('editor')
  const [active, setActive] = useState(0)
  const items = props.items

  useEffect(() => {
    setActive(0)
  }, [items])

  registerListKeyboardNav(registerKeyDown, {
    count: () => items.length,
    getActive: () => active,
    setActive,
    onPick: (index) => {
      const user = items[index]
      if (user) props.command(user)
    },
  })

  return (
    <div className="linkbase-menu" role="listbox" aria-label={t('mention.title')}>
      {items.length === 0 && <div className="linkbase-menu-empty">{t('mention.noResults')}</div>}
      {items.map((user, index) => (
        <button
          key={user.userId}
          type="button"
          className="linkbase-menu-item"
          data-active={index === active}
          onMouseEnter={() => setActive(index)}
          onMouseDown={(e) => {
            e.preventDefault()
            props.command(user)
          }}
        >
          <span className="linkbase-menu-item-avatar">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" width={18} height={18} />
            ) : (
              <span>{user.label.slice(0, 1).toUpperCase()}</span>
            )}
          </span>
          <span>{user.label}</span>
        </button>
      ))}
    </div>
  )
}
