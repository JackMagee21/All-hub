import { useState, useEffect } from 'react'
import { getSetting, setSetting } from '../lib/db'

export interface AppSettings {
  maxTokens: number
  trimBudget: number
}

const DEFAULTS: AppSettings = {
  maxTokens: 1024,
  trimBudget: 0.5,
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    Promise.all([
      getSetting('maxTokens', DEFAULTS.maxTokens),
      getSetting('trimBudget', DEFAULTS.trimBudget),
    ]).then(([maxTokens, trimBudget]) => {
      setSettings({ maxTokens, trimBudget })
      setLoaded(true)
    })
  }, [])

  async function updateSetting<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ) {
    const next = { ...settings, [key]: value }
    setSettings(next)
    await setSetting(key, value)
  }

  return { settings, updateSetting, loaded }
}