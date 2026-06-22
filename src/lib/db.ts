import { openDB, DBSchema } from 'idb'
import { Conversation } from '../types'

interface AIHubDB extends DBSchema {
  conversations: {
    key: string
    value: Conversation
    indexes: { 'by-updated': number }
  }
}

const dbPromise = openDB<AIHubDB>('ai-hub', 1, {
  upgrade(db) {
    const store = db.createObjectStore('conversations', { keyPath: 'id' })
    store.createIndex('by-updated', 'updatedAt')
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