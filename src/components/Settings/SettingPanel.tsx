import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { AppSettings } from '../../hooks/useSettings'
import styles from './SettingPanel.module.css'

interface Props {
  open: boolean
  onClose: () => void
  settings: AppSettings
  onUpdate: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void
  onKeyCleared: () => void
  onKeyUpdated: (key: string) => void
}

export default function SettingsPanel({
  open,
  onClose,
  settings,
  onUpdate,
  onKeyCleared,
  onKeyUpdated,
}: Props) {
  const [keyVisible, setKeyVisible] = useState(false)
  const [keyValue, setKeyValue] = useState('')
  const [keyStatus, setKeyStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [hasKey, setHasKey] = useState(false)

  useEffect(() => {
    if (open) {
      invoke<string | null>('get_key').then(k => setHasKey(!!k))
      setKeyValue('')
      setKeyStatus('idle')
      setKeyVisible(false)
    }
  }, [open])

  async function handleSaveKey() {
    const trimmed = keyValue.trim()
    if (!trimmed) return
    try {
      await invoke('save_key', { key: trimmed })
      onKeyUpdated(trimmed)
      setHasKey(true)
      setKeyValue('')
      setKeyStatus('saved')
      setTimeout(() => setKeyStatus('idle'), 2000)
    } catch {
      setKeyStatus('error')
    }
  }

  async function handleDeleteKey() {
    await invoke('delete_key')
    setHasKey(false)
    onKeyCleared()
  }

  if (!open) return null

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.panel}>
        <div className={styles.header}>
          <h2 className={styles.title}>Settings</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className={styles.content}>

          {/* API Section */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>API</h3>

            <div className={styles.field}>
              <label className={styles.label}>OpenRouter Key</label>
              <p className={styles.hint}>
                {hasKey ? 'A key is stored in Windows Credential Manager.' : 'No key stored yet.'}
              </p>
              <div className={styles.keyRow}>
                <input
                  className={styles.input}
                  type={keyVisible ? 'text' : 'password'}
                  placeholder={hasKey ? 'Enter new key to replace…' : 'sk-or-...'}
                  value={keyValue}
                  onChange={e => { setKeyValue(e.target.value); setKeyStatus('idle') }}
                  onKeyDown={e => e.key === 'Enter' && handleSaveKey()}
                />
                <button
                  className={styles.iconBtn}
                  onClick={() => setKeyVisible(v => !v)}
                  title={keyVisible ? 'Hide' : 'Show'}
                >
                  {keyVisible ? '🙈' : '👁'}
                </button>
              </div>
              <div className={styles.keyActions}>
                <button
                  className={styles.primaryBtn}
                  onClick={handleSaveKey}
                  disabled={!keyValue.trim()}
                >
                  {keyStatus === 'saved' ? '✓ Saved' : keyStatus === 'error' ? 'Error' : 'Save key'}
                </button>
                {hasKey && (
                  <button className={styles.dangerBtn} onClick={handleDeleteKey}>
                    Remove key
                  </button>
                )}
              </div>
            </div>
          </section>

          <div className={styles.divider} />

          {/* Tools Section */}
<section className={styles.section}>
  <h3 className={styles.sectionTitle}>Tools</h3>

  <div className={styles.field}>
    <div className={styles.toggleRow}>
      <div>
        <div className={styles.label}>File creation</div>
        <p className={styles.hint}>
          Allow the AI to create and read files on your computer. You'll approve every action before it runs.
        </p>
      </div>
      <button
        className={`${styles.toggle} ${settings.toolsEnabled ? styles.toggleOn : ''}`}
        onClick={() => onUpdate('toolsEnabled', !settings.toolsEnabled)}
        aria-label="Toggle file tools"
      >
        <span className={styles.toggleThumb} />
      </button>
    </div>
  </div>
  </section>
          {/* Generation Section */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Generation</h3>

            <div className={styles.field}>
              <div className={styles.labelRow}>
                <label className={styles.label}>Max tokens</label>
                <span className={styles.value}>{settings.maxTokens.toLocaleString()}</span>
              </div>
              <p className={styles.hint}>Maximum tokens the model can generate per response.</p>
              <input
                className={styles.slider}
                type="range"
                min={256}
                max={8192}
                step={256}
                value={settings.maxTokens}
                onChange={e => onUpdate('maxTokens', Number(e.target.value))}
              />
              <div className={styles.sliderLabels}>
                <span>256</span>
                <span>8192</span>
              </div>
            </div>

            <div className={styles.field}>
              <div className={styles.labelRow}>
                <label className={styles.label}>History trim budget</label>
                <span className={styles.value}>{Math.round(settings.trimBudget * 100)}%</span>
              </div>
              <p className={styles.hint}>
                Percentage of the model's context window used for message history. Lower values trim more aggressively and reduce cost.
              </p>
              <input
                className={styles.slider}
                type="range"
                min={0.1}
                max={0.9}
                step={0.05}
                value={settings.trimBudget}
                onChange={e => onUpdate('trimBudget', Number(e.target.value))}
              />
              <div className={styles.sliderLabels}>
                <span>10%</span>
                <span>90%</span>
              </div>
            </div>
          </section>

        </div>
      </div>
    </>
  )
}