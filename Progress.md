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
| Local persistence | idb (IndexedDB) | Conversation history survives app restarts |
| Token counting | gpt-tokenizer | Live estimates while typing |

---

## What Has Been Built

### 1. Streaming Chat (Rust backend)

The core of the app. Lives in `src-tauri/src/commands/chat.rs`:

- Sends chat requests to OpenRouter via `reqwest`
- Reads the SSE stream token by token
- Emits each token to the frontend as a Tauri event (`chat-token`)
- Parses the final usage chunk (`stream_options: { include_usage: true }`)
- Emits usage stats on completion (`chat-done`)
- Returns HTTP errors cleanly as Rust `Err(String)` so they surface in the UI

### 2. OS Keychain Integration

API keys are stored in the Windows Credential Manager via the `keyring` crate. Three Tauri commands in `src-tauri/src/commands/keys.rs`:

- `save_key(key)` — writes to the OS credential store
- `get_key()` — reads on startup; returns `None` if not set
- `delete_key()` — clears the stored credential

On startup the app checks the keychain. If no key is found, a full-screen `KeySetup` prompt is shown. Once set, the key is loaded silently on every subsequent launch. A `KeyManager` button in the header allows updating or removing the key without re-entering setup.

### 3. Dynamic Model Picker

Instead of a hardcoded registry, the app fetches the full OpenRouter model catalogue at startup via `fetch_models` (Rust command → `GET https://openrouter.ai/api/v1/models`). The model picker:

- Filters to text-output models only (excludes image/audio generation)
- Has a search box (needed — there are 300+ models)
- Has a Free / All tab toggle
- Shows each model's name, ID, and input price per million tokens
- Shows a green `free` badge on zero-cost models
- Opens upward from its position
- Auto-selects the default model on load so cost rates are available immediately

Pricing data from the API drives the cost calculation — no hardcoded rates.

### 4. Live Token Counter + Cost Meter

Two sources of token data run in parallel:

- **Live estimate** — `gpt-tokenizer` runs in the browser as the user types, showing `~N tokens`
- **Real counts** — parsed from OpenRouter's `usage` field after each response

Cost per turn:
```
cost = (prompt_tokens / 1,000,000) × inputRatePerM
     + (completion_tokens / 1,000,000) × outputRatePerM
```

Displayed below the input bar as `↑ 156 · ↓ 89 · $0.00006`. Rates update automatically when a different model is selected.

### 5. Chat UI

- **User messages** — right-aligned dark bubble with border
- **Assistant messages** — left-aligned plain text with coloured avatar
- **Waiting state** — animated three-dot pulse while streaming begins
- **Auto-scroll** — scrolls to bottom on each new message
- **Input bar** — auto-resizing textarea (grows to 200px), Enter to send, Shift+Enter for newline, send button disabled while streaming or when empty

### 6. IndexedDB Persistence

Conversations are saved to IndexedDB via the `idb` library (`src/lib/db.ts`). Persistence operations:

- `saveConversation` — upsert on every turn (twice: after user message, after assistant response)
- `loadConversations` — called on startup, returns all conversations sorted by most recent
- `deleteConversation` — removes from DB and sidebar list
- `toggleFavorite` — flips the `favorite` flag and persists

Each `Conversation` stores: `id`, `title` (auto-generated from first user message), `modelId`, `modelName`, `messages`, `totalCost`, `totalTokens`, `favorite`, `createdAt`, `updatedAt`.

### 7. Sidebar + Conversation List

A fixed 240px sidebar shows all past conversations:

- **Favourites section** — pinned at the top, gold star always visible
- **Date groups** — Today, Yesterday, Last 7 days, Older
- **Per-item info** — conversation title + model brand name in the model's brand colour (OpenAI green, Anthropic coral, Google blue, etc.)
- **Hover actions** — star button to favourite/unfavourite, ⋯ menu with favourite toggle and delete
- **New conversation** button in the sidebar header

### 8. History Trimming

Before each `invoke('chat', ...)` call, the message history is trimmed to fit within the model's context window (`src/lib/trimHistory.ts`):

- Budget: 50% of the model's `contextLength` (leaves room for the response)
- Strategy: sliding window — works backwards from most recent, keeps messages that fit
- If `contextLength` is unknown, trimming is skipped
- A subtle notice appears above the input when messages were trimmed: `"N older messages trimmed to fit context window"`

### 9. Code Architecture

**Rust** is split into focused modules:

```
src-tauri/src/
├── lib.rs              # run() and module declarations only
├── main.rs             # calls ai_hub_lib::run()
├── build.rs            # tauri_build::build()
├── types.rs            # ChatMessage, Usage, RemoteModel, ModelPricing, etc.
└── commands/
    ├── mod.rs
    ├── chat.rs         # streaming chat command
    ├── models.rs       # fetch_models command
    └── keys.rs         # save_key, get_key, delete_key
```

**Frontend** logic lives in custom hooks:

```
src/hooks/
├── useKeychain.ts    # OS keychain load/save/clear
├── useHistory.ts     # IndexedDB CRUD, active conversation state
└── useChat.ts        # streaming, input, trim, event listeners
```

`App.tsx` is a thin coordinator (~120 lines) — it calls the three hooks, wires their outputs together, and renders the layout.

### 10. Theming

Global design tokens in `src/styles/global.css`:

```css
--bg: #212121
--surface: #2f2f2f
--accent: #cc785c       /* warm coral */
--text: #ececec
--text-muted: #8e8ea0
--max-width: 720px
```

Scrollbars styled with `::-webkit-scrollbar` (Tauri uses a Chromium-based webview).

---

## Project Structure (Current State)

```
ai-hub/
├── src/
│   ├── App.tsx
│   ├── types.ts                          # interfaces, helpers (modelBrand, isFree, etc.)
│   ├── styles/
│   │   └── global.css
│   ├── components/
│   │   ├── Chat/
│   │   │   ├── InputBar.tsx + .module.css
│   │   │   └── MessageBubble.tsx + .module.css
│   │   ├── Meters/
│   │   │   └── TokenCounter.tsx + .module.css
│   │   ├── Sidebar/
│   │   │   ├── Sidebar.tsx + .module.css
│   │   │   ├── ConversationList.tsx + .module.css
│   │   │   └── ModelPicker.tsx + .module.css
│   │   ├── KeySetup.tsx + .module.css    # first-launch key entry screen
│   │   └── KeyManager.tsx + .module.css  # header button to update/remove key
│   ├── hooks/
│   │   ├── useKeychain.ts
│   │   ├── useHistory.ts
│   │   └── useChat.ts
│   └── lib/
│       ├── tokenizer.ts                  # gpt-tokenizer wrapper
│       ├── trimHistory.ts                # sliding window context trim
│       └── db.ts                         # idb setup + CRUD
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

**Duplicate event listeners** — Fixed. Unlisten refs are cleaned up at the start of each send so stale listeners never stack.

**Silent HTTP errors** — Fixed. The Rust chat command checks `response.status().is_success()` before streaming and surfaces the full error body to the UI.

**Free model rate limits** — Not a bug. A 429 from a free model means the upstream provider is rate-limited. Retry, add a SiliconFlow key in OpenRouter settings, or use a paid model.

**`context_length` serialisation** — Fixed. The Rust `RemoteModel` struct uses `#[serde(rename_all = "camelCase")]` so `context_length` arrives as `contextLength` in TypeScript, enabling correct history trimming.

**`persistConversation` stale closure** — The `persist` callback in `useHistory` has `conversations` and `activeId` as dependencies to correctly read `favorite` and `createdAt` from existing records without overwriting them.

---

## What Still Needs Building

### High Priority

**Markdown Rendering**
The single biggest quality-of-life gap. Assistant responses render as raw markdown syntax — code blocks, bullet points, and bold text all appear as plain text. A lightweight renderer like `react-markdown` (with `remark-gfm` for GitHub-flavoured markdown) would fix this. Code blocks should get syntax highlighting via `highlight.js` or `prism`.

**System Prompt Support**
No way to set a system prompt currently. Should be a collapsible panel or per-conversation settings drawer that prepends `{ role: 'system', content }` to every request. Useful for personas, formatting instructions, or domain constraints.

### Medium Priority

**Configurable `max_tokens`**
Currently hardcoded to `1024` in `commands/chat.rs`. Should be a per-model setting derived from the model's `top_provider.max_completion_tokens` from the OpenRouter API, or a user-configurable value in a settings panel.

**Ollama (Local Models)**
The spec includes an Ollama adapter for local models (`http://localhost:11434/api/chat`). Requires:
- A second Rust adapter in `commands/`
- Checking if Ollama is running before showing local models in the picker
- Gracefully hiding local models if the server is unreachable

**Error Recovery UI**
Errors appear as plain red text. A retry button, clearer error categorisation (auth error vs rate limit vs network failure), and dismissible error cards would improve the experience significantly.

**Settings Panel**
A dedicated settings view consolidating: default model selection, `max_tokens` override, history trim budget, theme toggle (light/dark), and API key management.

### Lower Priority

**Message-level Token Counts**
The `Message` interface could carry `tokenCount` and `cost` fields, shown on hover for granular per-message cost visibility.

**Export / Copy**
No way to copy a full conversation or export it as markdown or plain text. A button in the conversation header or sidebar options menu would cover this.

**Light Theme**
The app is dark-only. A light theme using the same CSS custom property system would be straightforward to add once a settings panel exists.

**Conversation Rename**
Titles are auto-generated from the first user message. A double-click or edit option in the sidebar would let users give conversations meaningful names.

---

## Remaining Build Order

1. **Markdown rendering** — biggest day-to-day quality gap
2. **System prompt support** — unlocks practical use cases
3. **Configurable max_tokens** — remove the hardcoded 1024 ceiling
4. **Settings panel** — consolidate configuration in one place
5. **Ollama adapter** — local model support
6. **Error recovery UI** — retry button, better error messages
7. **Export / copy** — conversation portability
8. **Light theme** — once settings panel exists
9. **Conversation rename** — polish