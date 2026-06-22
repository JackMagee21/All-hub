import { useState, useEffect, useRef } from 'react'
import { RemoteModel, inputRatePerM, outputRatePerM } from './types'
import { useKeychain } from './hooks/useKeychain'
import { useHistory } from './hooks/useHistory'
import { useChat } from './hooks/useChat'
import { useSettings } from './hooks/useSettings'
import { getFavoriteModels, setFavoriteModels } from './lib/db'
import InputBar from './components/Chat/InputBar'
import MessageBubble from './components/Chat/MessageBubble'
import TokenCounter from './components/Tokens/TokenCounter'
import ModelPicker from './components/Sidebar/ModelPicker'
import Sidebar from './components/Sidebar/Sidebar'
import SettingsPanel from './components/Settings/SettingPanel'
import KeySetup from './components/KeySetup'
import { countTokens } from './lib/tokeniser'

export default function App() {
  const keychain = useKeychain()
  const history = useHistory()
  const { settings, updateSetting } = useSettings()
  const [selectedModel, setSelectedModel] = useState<RemoteModel | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [favoriteModelIds, setFavoriteModelIds] = useState<string[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  const chat = useChat({
    apiKey: keychain.apiKey,
    modelId: history.modelId,
    selectedModel,
    messages: history.messages,
    setMessages: history.setMessages,
    totalCost: history.totalCost,
    totalTokens: history.totalTokens,
    settings,
    onCostsUpdate: (cost, tokens) => {
      history.setTotalCost(cost)
      history.setTotalTokens(tokens)
    },
    onPersist: (msgs, cost, tokens) =>
      history.persist(msgs, cost, tokens, history.modelId, selectedModel?.name ?? ''),
  })

  useEffect(() => {
    getFavoriteModels().then(setFavoriteModelIds)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history.messages])

  function handleModelSelect(model: RemoteModel) {
    setSelectedModel(model)
    history.setModelId(model.id)
  }

  async function handleToggleFavoriteModel(id: string) {
    const next = favoriteModelIds.includes(id)
      ? favoriteModelIds.filter(f => f !== id)
      : [...favoriteModelIds, id]
    setFavoriteModelIds(next)
    await setFavoriteModels(next)
  }

  const liveTokens = countTokens(chat.input)

  const cost = chat.lastUsage && selectedModel
    ? (chat.lastUsage.prompt_tokens / 1_000_000) * inputRatePerM(selectedModel) +
      (chat.lastUsage.completion_tokens / 1_000_000) * outputRatePerM(selectedModel)
    : undefined

  if (keychain.keyState === 'loading') return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--text-muted)',
    }}>
      Loading…
    </div>
  )

  if (keychain.keyState === 'missing') return (
    <KeySetup onSave={keychain.saveKey} />
  )

  return (
    <div style={{ display: 'flex', height: '100vh' }}>

      <Sidebar
        conversations={history.conversations}
        activeId={history.activeId}
        onSelect={history.selectConversation}
        onNew={history.startNewConversation}
        onDelete={history.removeConversation}
        onFavorite={history.toggleFavoriteConversation}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Header */}
        <div style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
        }}>
          <button
            onClick={() => setSettingsOpen(true)}
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '5px 10px',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              transition: 'color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => {
              const btn = e.currentTarget as HTMLButtonElement
              btn.style.color = 'var(--text)'
              btn.style.borderColor = 'rgba(255,255,255,0.25)'
            }}
            onMouseLeave={e => {
              const btn = e.currentTarget as HTMLButtonElement
              btn.style.color = 'var(--text-muted)'
              btn.style.borderColor = 'var(--border)'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" stroke="currentColor" strokeWidth="2"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" strokeWidth="2"/>
            </svg>
            Settings
          </button>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '24px 16px',
        }}>
          <div style={{ maxWidth: 'var(--max-width)', margin: '0 auto' }}>
            {history.messages.length === 0 && (
              <p style={{
                color: 'var(--text-muted)',
                textAlign: 'center',
                marginTop: 60,
              }}>
                Start a conversation
              </p>
            )}
            {history.messages.map(msg => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {chat.error && (
              <p style={{ color: '#e05c5c', fontSize: 13, marginTop: 8 }}>
                {chat.error}
              </p>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input area */}
        <div style={{
          padding: '12px 16px 20px',
          maxWidth: 'var(--max-width)',
          margin: '0 auto',
          width: '100%',
        }}>
          {chat.trimmedCount > 0 && (
            <p style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              textAlign: 'center',
              marginBottom: 4,
            }}>
              {chat.trimmedCount} older {chat.trimmedCount === 1 ? 'message' : 'messages'} trimmed to fit context window
            </p>
          )}
          <TokenCounter
            liveTokens={liveTokens}
            promptTokens={chat.lastUsage?.prompt_tokens}
            completionTokens={chat.lastUsage?.completion_tokens}
            cost={cost}
          />
          <InputBar
            input={chat.input}
            onInputChange={chat.setInput}
            onSend={chat.send}
            disabled={chat.isStreaming}
            modelPicker={
              <ModelPicker
                selectedId={history.modelId}
                onSelect={handleModelSelect}
                favoriteIds={favoriteModelIds}
                onToggleFavorite={handleToggleFavoriteModel}
              />
            }
          />
        </div>

      </div>

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onUpdate={updateSetting}
        onKeyCleared={() => { keychain.clearKey(); setSettingsOpen(false) }}
        onKeyUpdated={keychain.setApiKey}
      />

    </div>
  )
}