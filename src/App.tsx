import { useState, useEffect, useRef } from 'react'
import { RemoteModel, inputRatePerM, outputRatePerM } from './types'
import { useKeychain } from './hooks/useKeychain'
import { useHistory } from './hooks/useHistory'
import { useChat } from './hooks/useChat'
import InputBar from './components/Chat/InputBar'
import MessageBubble from './components/Chat/MessageBubble'
import TokenCounter from './components/Tokens/TokenCounter'
import ModelPicker from './components/Sidebar/ModelPicker'
import Sidebar from './components/Sidebar/Sidebar'
import KeySetup from './components/KeySetup'
import KeyManager from './components/KeyManager'
import { countTokens } from './lib/tokeniser'

export default function App() {
  const keychain = useKeychain()
  const history = useHistory()
  const [selectedModel, setSelectedModel] = useState<RemoteModel | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const chat = useChat({
    apiKey: keychain.apiKey,
    modelId: history.modelId,
    selectedModel,
    messages: history.messages,
    setMessages: history.setMessages,
    totalCost: history.totalCost,
    totalTokens: history.totalTokens,
    onCostsUpdate: (cost, tokens) => {
      history.setTotalCost(cost)
      history.setTotalTokens(tokens)
    },
    onPersist: (msgs, cost, tokens) =>
      history.persist(msgs, cost, tokens, history.modelId, selectedModel?.name ?? ''),
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history.messages])

  function handleModelSelect(model: RemoteModel) {
    setSelectedModel(model)
    history.setModelId(model.id)
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

        <div style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <ModelPicker selectedId={history.modelId} onSelect={handleModelSelect} />
          <div style={{ flex: 1 }} />
          <KeyManager onCleared={keychain.clearKey} onUpdated={keychain.setApiKey} />
        </div>

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
              <p style={{ color: '#e05c5c', fontSize: 13, marginTop: 8 }}>{chat.error}</p>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

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
          />
        </div>

      </div>
    </div>
  )
}