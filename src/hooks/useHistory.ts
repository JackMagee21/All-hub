import { useState, useEffect, useCallback } from 'react'
import { Conversation, Message, generateTitle, modelBrand } from '../types'
import {
  saveConversation as dbSave,
  loadConversations as dbLoad,
  deleteConversation as dbDelete,
  toggleFavorite as dbToggleFavorite,
} from '../lib/db'

const DEFAULT_MODEL = 'openai/gpt-4.1-mini'

export function useHistory() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string>(() => crypto.randomUUID())
  const [messages, setMessages] = useState<Message[]>([])
  const [modelId, setModelId] = useState(DEFAULT_MODEL)
  const [totalCost, setTotalCost] = useState(0)
  const [totalTokens, setTotalTokens] = useState(0)

  useEffect(() => {
    dbLoad().then(setConversations)
  }, [])

  async function refreshList() {
    setConversations(await dbLoad())
  }

  const persist = useCallback(async (
    msgs: Message[],
    cost: number,
    tokens: number,
    currentModelId: string,
    modelName: string,
  ) => {
    const existing = conversations.find(c => c.id === activeId)
    const conv: Conversation = {
      id: activeId,
      title: generateTitle(msgs),
      modelId: currentModelId,
      modelName: modelName || modelBrand(currentModelId),
      messages: msgs,
      totalCost: cost,
      totalTokens: tokens,
      favorite: existing?.favorite ?? false,
      createdAt: existing?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    }
    await dbSave(conv)
    await refreshList()
  }, [activeId, conversations])

  function selectConversation(conv: Conversation) {
    setActiveId(conv.id)
    setMessages(conv.messages)
    setModelId(conv.modelId)
    setTotalCost(conv.totalCost)
    setTotalTokens(conv.totalTokens)
  }

  function startNewConversation() {
    setActiveId(crypto.randomUUID())
    setMessages([])
    setTotalCost(0)
    setTotalTokens(0)
  }

  async function removeConversation(id: string) {
    await dbDelete(id)
    await refreshList()
    if (id === activeId) startNewConversation()
  }

  async function toggleFavoriteConversation(id: string) {
    await dbToggleFavorite(id)
    await refreshList()
  }

  return {
    conversations,
    activeId,
    messages,
    setMessages,
    modelId,
    setModelId,
    totalCost,
    setTotalCost,
    totalTokens,
    setTotalTokens,
    persist,
    selectConversation,
    startNewConversation,
    removeConversation,
    toggleFavoriteConversation,
  }
}