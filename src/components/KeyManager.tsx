import { useState, useRef, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import styles from './KeyManager.module.css'

interface Props {
  onCleared: () => void
  onUpdated: (key: string) => void
}

export default function KeyManager({ onCleared, onUpdated }: Props) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setEditing(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleClear() {
    await invoke('delete_key')
    setOpen(false)
    onCleared()
  }

  async function handleUpdate() {
    const trimmed = value.trim()
    if (!trimmed) return
    await invoke('save_key', { key: trimmed })
    onUpdated(trimmed)
    setEditing(false)
    setOpen(false)
    setValue('')
  }

  return (
    <div className={styles.wrapper} ref={ref}>
      <button className={styles.trigger} onClick={() => setOpen(o => !o)} title="API Key">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        API Key
      </button>

      {open && (
        <div className={styles.dropdown}>
          {editing ? (
            <div className={styles.editRow}>
              <input
                className={styles.input}
                type="password"
                placeholder="sk-or-..."
                value={value}
                onChange={e => setValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleUpdate()}
                autoFocus
              />
              <button className={styles.saveBtn} onClick={handleUpdate}>Save</button>
            </div>
          ) : (
            <>
              <button className={styles.item} onClick={() => setEditing(true)}>
                Update key
              </button>
              <button className={`${styles.item} ${styles.danger}`} onClick={handleClear}>
                Remove key
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}