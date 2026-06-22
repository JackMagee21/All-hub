# AI Hub — Project Documentation

## What Is This?

AI Hub is a personal desktop chat application built with **Tauri 2 + React + TypeScript**. It provides a single interface to talk to multiple AI models through OpenRouter's API, with no subscription — you pay per token using your own API key. The goal is a fast, native desktop app with real cost visibility and no middleman markup beyond OpenRouter's standard rates.

---

## Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Desktop shell | Tauri 2 | Native window, OS keychain access, no Electron overhead |
| UI | React 18 + TypeScript | Component model, typed state |
| Build tool | Vite | Fast HMR during development |
| Styling | CSS Modules + CSS custom properties | Scoped styles, no runtime cost |
| Backend | Rust (inside Tauri core) | Handles HTTP, streaming, no Node server in production |
| HTTP client | reqwest (Rust, async + streaming) | Async SSE streaming from AI providers |
| Hosted models | OpenRouter | One API key covers all hosted models |
| Local persistence | idb (IndexedDB) | Conversations and settings survive app restarts |
| Token counting | gpt-tokenizer | Live estimates while typing |
| Markdown | react-markdown + remark-gfm | Renders AI responses with formatting |
| Syntax highlighting | react-syntax-highlighter | Coloured code blocks in AI responses |

---

## What Has Been Built

### 1. Streaming Chat (Rust backend)

Lives in `src-tauri/src/commands/chat.rs`. Sends requests to OpenRouter, reads the SSE stream token by token, emits each token as a Tauri event (`chat-token`), parses usage stats from the final chunk, and emits them on completion (`chat-done`). HTTP errors are returned as Rust `Err(String)` and surface cleanly in the UI. `max_tokens` is configurable — passed from the frontend rather than hardcoded.

### 2. OS Keychain Integration

API keys are stored in the Windows Credential Manager via the `keyring` crate (`src-tauri/src/commands/keys.rs`). Three commands: `save_key`, `get_key`, `delete_key`. On startup the app checks the keychain silently — if no key is found, a full-screen `KeySetup` prompt appears. Key management (update / remove) lives in the Settings panel.

### 3. Dynamic Model Picker

Fetches the full OpenRouter model catalogue on startup (`GET https://openrouter.ai/api/v1/models`) via the `fetch_models` Rust command. The picker:

- Filters to text-output models only
- Has a search box
- Has **Favourites / All / Free** tabs
- Shows model name, ID, and price per million input tokens
- Shows a green `free` badge on zero-cost models
- Lets users star individual models — stars persist to IndexedDB
- Sits inside the input bar (bottom-left), with the dropdown opening upward
- Auto-selects the default model on load so cost rates are available immediately

### 4. Live Token Counter + Cost Meter

Two sources of token data run in parallel:

- **Live estimate** — `gpt-tokenizer` as the user types, shows `~N tokens`
- **Real counts** — parsed from OpenRouter's `usage` field after each response

Cost per turn:
```
cost = (prompt_tokens / 1,000,000) × inputRatePerM
     + (completion_tokens / 1,000,000) × outputRatePerM
```

Displayed below the input bar as `↑ 156 · ↓ 89 · $0.00006`. Rates update automatically when a model is switched.

### 5. Markdown Rendering

Assistant responses render fully formatted markdown via `react-markdown` + `remark-gfm`:

- Bold, italic, strikethrough
- Inline code (styled with monospace + subtle highlight)
- Fenced code blocks with syntax highlighting (`react-syntax-highlighter`, oneDark theme)
- Bullet and numbered lists
- Tables (with horizontal scroll for wide tables)
- Blockquotes (left accent border)
- Headings, horizontal rules, links

User messages remain plain text.

### 6. Chat UI

- **User messages** — right-aligned dark bubble
- **Assistant messages** — left-aligned with coloured avatar, markdown rendered
- **Waiting state** — animated three-dot pulse while streaming begins
- **Auto-scroll** — scrolls to bottom on each new message
- **Input bar** — column layout, auto-resizing textarea (up to 200px), model picker bottom-left, send button bottom-right, Enter to send, Shift+Enter for newline

### 7. IndexedDB Persistence

Conversations saved to IndexedDB via `idb` (`src/lib/db.ts`). Each `Conversation` stores: `id`, `title` (auto-generated from first user message), `modelId`, `modelName`, `messages`, `totalCost`, `totalTokens`, `favorite`, `createdAt`, `updatedAt`. Saved twice per turn — after the user message and again after the assistant response completes with real usage data.

Settings (max tokens, trim budget, favourite model IDs) are also persisted to a separate IndexedDB store added in the v2 schema migration.

### 8. Sidebar + Conversation List

Fixed 240px sidebar showing all past conversations:

- **Favourites section** — pinned at top, gold star always visible
- **Date groups** — Today, Yesterday, Last 7 days, Older
- **Per-item info** — title + model brand name in the model's brand colour
- **Hover actions** — star toggle, ⋯ options menu (favourite/unfavourite, delete)
- **New conversation** button in sidebar header

### 9. History Trimming

Before each send, message history is trimmed to fit within the model's context window (`src/lib/trimHistory.ts`). Sliding window — works backwards from most recent. Budget is configurable (default 50% of context window). A notice appears when messages are trimmed. Trimming is skipped if context window is unknown.

### 10. Settings Panel

Right-side drawer opened via a gear button in the header. Sections:

- **API** — show/hide key, update key, remove key (writes to OS keychain)
- **Generation** — max tokens slider (256–8192), history trim budget slider (10%–90%)

Settings persist to IndexedDB immediately on change.

### 11. Code Architecture

**Rust** split into focused modules:

```
src-tauri/src/
├── lib.rs              # run() and module declarations only
├── main.rs             # calls ai_hub_lib::run()
├── build.rs
├── types.rs            # ChatMessage, Usage, RemoteModel, etc.
└── commands/
    ├── mod.rs
    ├── chat.rs         # streaming chat
    ├── models.rs       # fetch_models
    └── keys.rs         # save_key, get_key, delete_key
```

**Frontend** split into custom hooks:

```
src/hooks/
├── useKeychain.ts    # OS keychain load/save/clear
├── useHistory.ts     # IndexedDB CRUD, active conversation state
├── useChat.ts        # streaming, input, trim, event listeners
└── useSettings.ts    # load/save app settings
```

`App.tsx` is a thin coordinator (~150 lines) — calls hooks, wires outputs, renders layout.

### 12. Theming

Global design tokens in `src/styles/global.css`:

```css
--bg: #212121
--surface: #2f2f2f
--accent: #cc785c
--text: #ececec
--text-muted: #8e8ea0
--max-width: 720px
```

---

## Current Project Structure

```
ai-hub/
├── src/
│   ├── App.tsx
│   ├── types.ts
│   ├── styles/
│   │   └── global.css
│   ├── components/
│   │   ├── Chat/
│   │   │   ├── InputBar.tsx + .module.css
│   │   │   ├── MessageBubble.tsx + .module.css
│   │   │   └── MarkdownContent.tsx + .module.css
│   │   ├── Meters/
│   │   │   └── TokenCounter.tsx + .module.css
│   │   ├── Sidebar/
│   │   │   ├── Sidebar.tsx + .module.css
│   │   │   ├── ConversationList.tsx + .module.css
│   │   │   └── ModelPicker.tsx + .module.css
│   │   ├── Settings/
│   │   │   └── SettingsPanel.tsx + .module.css
│   │   └── KeySetup.tsx + .module.css
│   ├── hooks/
│   │   ├── useKeychain.ts
│   │   ├── useHistory.ts
│   │   ├── useChat.ts
│   │   └── useSettings.ts
│   └── lib/
│       ├── tokenizer.ts
│       ├── trimHistory.ts
│       └── db.ts
│
└── src-tauri/
    ├── build.rs
    ├── Cargo.toml
    ├── tauri.conf.json
    ├── capabilities/
    │   └── default.json
    └── src/
        ├── lib.rs
        ├── main.rs
        ├── types.rs
        └── commands/
            ├── mod.rs
            ├── chat.rs
            ├── models.rs
            └── keys.rs
```

---

## Known Issues and Edge Cases

**Duplicate event listeners** — Fixed. Unlisten refs cleaned up at the start of each send.

**Silent HTTP errors** — Fixed. Status check before streaming; full error body returned to UI.

**Free model rate limits** — Not a bug. 429 from a free model = upstream rate limit. Retry, add a provider key, or use a paid model.

**`context_length` serialisation** — Fixed. `#[serde(rename_all = "camelCase")]` on the Rust `RemoteModel` struct ensures `contextLength` arrives correctly in TypeScript.

**`persistConversation` stale closure** — `persist` in `useHistory` has `conversations` and `activeId` as dependencies so `favorite` and `createdAt` are read from existing records without overwriting them.

**Model picker auto-selection** — The picker calls `onSelect` when models load so `selectedModel` is populated immediately and cost calculation works on the first response.

---

## What Still Needs Building

### High Priority

**System Prompt Support**
No way to set a system prompt. Should be a collapsible panel or per-conversation setting that prepends `{ role: 'system', content }` to every request. Essential for personas, formatting instructions, or domain-specific constraints.

**Ollama (Local Models)**
The original spec includes an Ollama adapter (`http://localhost:11434/api/chat`). Requires a second Rust adapter in `commands/`, a check that Ollama is running before showing local models, and graceful hiding if the server is unreachable.

### Medium Priority

**Error Recovery UI**
Errors currently appear as plain red text. A retry button, clearer error categorisation (auth error vs rate limit vs network failure vs timeout), and dismissible error cards would significantly improve the experience.

**Conversation Rename**
Titles are auto-generated from the first user message and cannot be changed. A double-click or inline edit in the sidebar would fix this.

**Export / Copy**
No way to copy a full conversation or export it as markdown or plain text. A button in the conversation header or sidebar options menu would cover this.

### Lower Priority

**Light Theme**
The app is dark-only. A light theme toggle using the existing CSS custom property system would be straightforward to add now that the settings panel exists.

**Message-level Token Counts**
The `Message` type could carry `tokenCount` and `cost` per message, shown on hover for granular cost visibility per turn.

**Configurable Default Model**
The default model is hardcoded to `openai/gpt-4.1-mini`. Letting users set a preferred default in the settings panel would be a small but useful quality-of-life improvement.

**Streaming Cancellation**
No way to stop a response mid-stream. A stop button that appears while streaming and cancels the in-flight request would prevent wasted tokens on runaway responses.

---

## Suggested Next Steps (in order)

1. **System prompt support** — most practically useful next feature; unlocks personas and formatting control
2. **Conversation rename** — small change, high daily use value
3. **Streaming cancellation** — stop button during responses
4. **Ollama adapter** — local model support, completes the original spec
5. **Error recovery UI** — retry button and better error messages
6. **Export / copy** — conversation portability
7. **Light theme** — polish, easy win now settings panel exists
8. **Configurable default model** — settings panel addition
9. **Message-level token counts** — nice-to-have detail