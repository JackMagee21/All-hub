import { useState, useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { RemoteModel, isFree, isTextModel, inputRatePerM } from '../../types'
import styles from './ModelPicker.module.css'

interface Props {
  selectedId: string
  onSelect: (model: RemoteModel) => void
  favoriteIds: string[]
  onToggleFavorite: (id: string) => void
}

type Tab = 'favorites' | 'all' | 'free'

export default function ModelPicker({ selectedId, onSelect, favoriteIds, onToggleFavorite }: Props) {
  const [models, setModels] = useState<RemoteModel[]>([])
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<Tab>('all')
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setLoading(true)
    invoke<RemoteModel[]>('fetch_models')
      .then(data => {
        const filtered = data.filter(isTextModel)
        setModels(filtered)
        const current = filtered.find(m => m.id === selectedId)
        if (current) onSelect(current)
      })
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
    const matchesSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.id.toLowerCase().includes(search.toLowerCase())
    if (tab === 'favorites') return matchesSearch && favoriteIds.includes(m.id)
    if (tab === 'free') return matchesSearch && isFree(m)
    return matchesSearch
  })

  const hasFavorites = favoriteIds.length > 0

  return (
    <div className={styles.wrapper} ref={ref}>
      <button className={styles.trigger} onClick={() => setOpen(o => !o)}>
        <span className={styles.triggerText}>
          {loading ? 'Loading…' : (selected?.name ?? 'Select model')}
        </span>
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
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
              {hasFavorites && (
                <button
                  className={`${styles.tab} ${tab === 'favorites' ? styles.activeTab : ''}`}
                  onClick={() => setTab('favorites')}
                >
                  ★ Favourites
                </button>
              )}
              <button
                className={`${styles.tab} ${tab === 'all' ? styles.activeTab : ''}`}
                onClick={() => setTab('all')}
              >
                All
              </button>
              <button
                className={`${styles.tab} ${tab === 'free' ? styles.activeTab : ''}`}
                onClick={() => setTab('free')}
              >
                Free
              </button>
            </div>
          </div>

          <div className={styles.list}>
            {filtered.length === 0 && (
              <div className={styles.empty}>
                {tab === 'favorites' ? 'No favourites yet — star a model below' : 'No models found'}
              </div>
            )}
            {filtered.map(m => {
              const isFav = favoriteIds.includes(m.id)
              return (
                <div
                  key={m.id}
                  className={`${styles.option} ${m.id === selectedId ? styles.selected : ''}`}
                >
                  <button
                    className={styles.optionMain}
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
                          ${inputRatePerM(m).toFixed(2)}/M
                        </span>
                      )}
                    </div>
                  </button>
                  <button
                    className={`${styles.starBtn} ${isFav ? styles.starred : ''}`}
                    onClick={e => { e.stopPropagation(); onToggleFavorite(m.id) }}
                    aria-label={isFav ? 'Unfavourite' : 'Favourite'}
                    title={isFav ? 'Unfavourite' : 'Favourite'}
                  >
                    {isFav ? '★' : '☆'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}