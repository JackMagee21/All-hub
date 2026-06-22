import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'

export type KeyState = 'loading' | 'missing' | 'ready'

export function useKeychain() {
  const [keyState, setKeyState] = useState<KeyState>('loading')
  const [apiKey, setApiKey] = useState('')

  useEffect(() => {
    invoke<string | null>('get_key')
      .then(key => {
        if (key) { setApiKey(key); setKeyState('ready') }
        else setKeyState('missing')
      })
      .catch(() => setKeyState('missing'))
  }, [])

  async function saveKey(key: string) {
    await invoke('save_key', { key })
    setApiKey(key)
    setKeyState('ready')
  }

  function clearKey() {
    setApiKey('')
    setKeyState('missing')
  }

  return { keyState, apiKey, setApiKey, saveKey, clearKey }
}