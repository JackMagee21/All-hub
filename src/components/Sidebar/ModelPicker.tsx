import { useState, useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { RemoteModel, isFree, isTextModel, inputRatePerM, outputRatePerM } from '../../types'
import styles from './ModelPicker.module.css'

interface Props {
  selectedId: string
  onSelect: (model: RemoteModel) => void
}

export default function ModelPicker({ selectedId, onSelect }: Props) {
  const [models, setModels] = useState<RemoteModel[]>([])
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'all' | 'free'>('all')
  const ref = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setLoading(true)
    invoke<RemoteModel[]>('fetch_models')
      .then(data => setModels(data.filter(isTextModel)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50)
    else setSearch('')
  }, [open])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const selected = models.find(m => m.id === selectedId)

  const filtered = models.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.id.toLowerCase().includes(search.toLowerCase())
    const matchesTab = tab === 'free' ? isFree(m) : true
    return matchesSearch && matchesTab
  })

  return (
    <div className={styles.wrapper} ref={ref}>
      <button className={styles.trigger} onClick={() => setOpen(o => !o)}>
        <span>{loading ? 'Loading…' : (selected?.name ?? 'Select model')}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.header}>
            <input
              ref={searchRef}
              className={styles.search}
              placeholder="Search models…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div className={styles.tabs}>
              <button className={`${styles.tab} ${tab === 'all' ? styles.activeTab : ''}`}
                onClick={() => setTab('all')}>All</button>
              <button className={`${styles.tab} ${tab === 'free' ? styles.activeTab : ''}`}
                onClick={() => setTab('free')}>Free</button>
            </div>
          </div>

          <div className={styles.list}>
            {filtered.length === 0 && (
              <div className={styles.empty}>No models found</div>
            )}
            {filtered.map(m => (
              <button
                key={m.id}
                className={`${styles.option} ${m.id === selectedId ? styles.selected : ''}`}
                onClick={() => { onSelect(m); setOpen(false) }}
              >
                <div className={styles.optionLeft}>
                  <div className={styles.optionName}>{m.name}</div>
                  <div className={styles.optionId}>{m.id}</div>
                </div>
                <div className={styles.optionRight}>
                  {isFree(m) ? (
                    <span className={styles.freeTag}>free</span>
                  ) : (
                    <span className={styles.price}>
                      ${inputRatePerM(m).toFixed(2)}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}