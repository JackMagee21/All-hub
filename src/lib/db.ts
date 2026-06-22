import { openDB, DBSchema } from 'idb'
import { Conversation } from '../types'

interface AppSettings {
  key: string
  value: unknown
}

interface AIHubDB extends DBSchema {
  conversations: {
    key: string
    value: Conversation
    indexes: { 'by-updated': number }
  }
  settings: {
    key: string
    value: AppSettings
  }
}

const dbPromise = openDB<AIHubDB>('ai-hub', 2, {
  upgrade(db, oldVersion) {
    if (oldVersion < 1) {
      const store = db.createObjectStore('conversations', { keyPath: 'id' })
      store.createIndex('by-updated', 'updatedAt')
    }
    if (oldVersion < 2) {
      db.createObjectStore('settings', { keyPath: 'key' })
    }
  },
})

export async function saveConversation(conv: Conversation): Promise<void> {
  await (await dbPromise).put('conversations', conv)
}

export async function loadConversations(): Promise<Conversation[]> {
  const all = await (await dbPromise).getAllFromIndex('conversations', 'by-updated')
  return all.reverse()
}

export async function deleteConversation(id: string): Promise<void> {
  await (await dbPromise).delete('conversations', id)
}

export async function toggleFavorite(id: string): Promise<void> {
  const db = await dbPromise
  const conv = await db.get('conversations', id)
  if (!conv) return
  await db.put('conversations', { ...conv, favorite: !conv.favorite })
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const db = await dbPromise
  const result = await db.get('settings', key)
  return result ? (result.value as T) : fallback
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  await (await dbPromise).put('settings', { key, value })
}

export async function getFavoriteModels(): Promise<string[]> {
  return getSetting<string[]>('favoriteModels', [])
}

export async function setFavoriteModels(ids: string[]): Promise<void> {
  await setSetting('favoriteModels', ids)
}