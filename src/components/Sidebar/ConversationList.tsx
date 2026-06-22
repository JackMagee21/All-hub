import { useState, useRef, useEffect } from 'react'
import { Conversation, modelBrand, modelBrandColor } from '../../types'
import styles from './ConversationList.module.css'

interface Props {
  conversations: Conversation[]
  activeId: string
  onSelect: (conv: Conversation) => void
  onDelete: (id: string) => void
  onFavorite: (id: string) => void
}

function groupByDate(conversations: Conversation[]): [string, Conversation[]][] {
  const today = new Date().setHours(0, 0, 0, 0)
  const yesterday = today - 86_400_000
  const lastWeek = today - 7 * 86_400_000

  const groups: Record<string, Conversation[]> = {
    'Today': [],
    'Yesterday': [],
    'Last 7 days': [],
    'Older': [],
  }

  for (const conv of conversations) {
    if (conv.updatedAt >= today) groups['Today'].push(conv)
    else if (conv.updatedAt >= yesterday) groups['Yesterday'].push(conv)
    else if (conv.updatedAt >= lastWeek) groups['Last 7 days'].push(conv)
    else groups['Older'].push(conv)
  }

  return Object.entries(groups).filter(([, items]) => items.length > 0)
}

function ConversationItem({ conv, active, onSelect, onDelete, onFavorite }: {
  conv: Conversation
  active: boolean
  onSelect: () => void
  onDelete: () => void
  onFavorite: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div
      className={`${styles.item} ${active ? styles.active : ''}`}
      onClick={onSelect}
    >
      <div className={styles.itemContent}>
        <span className={styles.title}>{conv.title}</span>
        <div className={styles.meta}>
          <span
            className={styles.modelBadge}
            style={{ color: modelBrandColor(conv.modelId) }}
          >
            {conv.modelName || modelBrand(conv.modelId)}
          </span>
        </div>
      </div>

      <div className={styles.actions} onClick={e => e.stopPropagation()}>
        <button
          className={`${styles.actionBtn} ${conv.favorite ? styles.favorited : ''}`}
          onClick={onFavorite}
          aria-label="Favourite"
          title="Favourite"
        >
          {conv.favorite ? '★' : '☆'}
        </button>

        <div className={styles.menuWrapper} ref={menuRef}>
          <button
            className={styles.actionBtn}
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Options"
          >
            ⋯
          </button>
          {menuOpen && (
            <div className={styles.menu}>
              <button
                className={styles.menuItem}
                onClick={() => { onFavorite(); setMenuOpen(false) }}
              >
                {conv.favorite ? '★ Unfavourite' : '☆ Favourite'}
              </button>
              <div className={styles.menuDivider} />
              <button
                className={`${styles.menuItem} ${styles.danger}`}
                onClick={() => { onDelete(); setMenuOpen(false) }}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ConversationList({ conversations, activeId, onSelect, onDelete, onFavorite }: Props) {
  const favorites = conversations.filter(c => c.favorite)
  const rest = conversations.filter(c => !c.favorite)
  const groups = groupByDate(rest)

  if (conversations.length === 0) {
    return <p className={styles.empty}>No conversations yet</p>
  }

  return (
    <div className={styles.list}>
      {favorites.length > 0 && (
        <div className={styles.group}>
          <div className={styles.groupLabel}>★ Favourites</div>
          {favorites.map(conv => (
            <ConversationItem
              key={conv.id}
              conv={conv}
              active={conv.id === activeId}
              onSelect={() => onSelect(conv)}
              onDelete={() => onDelete(conv.id)}
              onFavorite={() => onFavorite(conv.id)}
            />
          ))}
        </div>
      )}

      {groups.map(([label, items]) => (
        <div key={label} className={styles.group}>
          <div className={styles.groupLabel}>{label}</div>
          {items.map(conv => (
            <ConversationItem
              key={conv.id}
              conv={conv}
              active={conv.id === activeId}
              onSelect={() => onSelect(conv)}
              onDelete={() => onDelete(conv.id)}
              onFavorite={() => onFavorite(conv.id)}
            />
          ))}
        </div>
      ))}
    </div>
  )
}