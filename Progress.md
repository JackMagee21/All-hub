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
| Token counting | gpt-tokenizer | Live estimates while typing |

---

## What Has Been Built

### 1. Streaming Chat (Rust backend)

The core of the app. The Rust backend (`src-tauri/src/lib.rs`) handles:

- Sending a chat request to OpenRouter via `reqwest`
- Reading the SSE (Server-Sent Events) stream token by token
- Emitting each token to the frontend as a Tauri event (`chat-token`)
- Parsing the final usage chunk from OpenRouter (`stream_options: { include_usage: true }`)
- Emitting usage stats (prompt tokens, completion tokens) on completion (`chat-done`)
- Returning HTTP errors cleanly as Rust `Err(String)` so they surface in the UI

The Tauri command signature:
```rust
async fn chat(app: AppHandle, model_id: String, messages: Vec<ChatMessage>, api_key: String)
```

The frontend triggers it via `invoke('chat', {...})` and listens for events via `listen('chat-token', ...)`.

### 2. Live Token Counter + Cost Meter

Two sources of token data run in parallel:

- **Live estimate** — `gpt-tokenizer` runs in the browser as the user types, showing `~N tokens` before sending
- **Real counts** — parsed from OpenRouter's `usage` field in the final SSE chunk after each response

Cost is calculated as:
```
cost = (prompt_tokens / 1,000,000) × inputRatePerM
     + (completion_tokens / 1,000,000) × outputRatePerM
```

Rates come from the selected model's live pricing data (see Model Picker below). Displayed below the input bar as `↑ 156 · ↓ 89 · $0.00006`.

### 3. Dynamic Model Picker

Instead of a hardcoded registry, the app fetches the full OpenRouter model catalogue at startup:

```
GET https://openrouter.ai/api/v1/models
```

The Rust `fetch_models` command fetches and deserialises the response, returning a `Vec<RemoteModel>` to the frontend. The model picker then:

- Filters to text-output models only (excludes image/audio generation)
- Provides a search box (needed — there are 300+ models)
- Has a Free/All tab toggle
- Shows each model's ID, name, and input price per million tokens
- Shows a green `free` badge on zero-cost models

Selecting a model updates the active `modelId` used in `invoke('chat', ...)` and the rate used for cost calculation.

### 4. Chat UI

The message list renders user and assistant messages as distinct components:

- **User messages** — right-aligned, subtle dark bubble with border
- **Assistant messages** — left-aligned plain text with an avatar indicator
- **Waiting state** — animated three-dot pulse while streaming begins
- **Auto-scroll** — a `ref` on a div at the bottom of the list scrolls into view on each state update

The input bar (`InputBar.tsx`) features:
- Auto-resizing textarea (grows up to 200px, then scrolls)
- Enter to send, Shift+Enter for newline
- Send button disabled while streaming is in progress
- Send button disabled when input is empty

### 5. Tauri Capabilities + Permissions

Tauri 2 uses a capability file (`src-tauri/capabilities/default.json`) to control what the webview is allowed to do. The key lesson from setup: the `local: true` flag is required for permissions to apply to local webview content, and inline capabilities in `tauri.conf.json` conflict with file-based ones if both use the same identifier.

Working capability config:
```json
{
  "local": true,
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:event:allow-listen",
    "core:event:allow-unlisten",
    "core:event:allow-emit",
    "core:event:allow-emit-to"
  ]
}
```

### 6. Theming

Global design tokens live in `src/styles/global.css` as CSS custom properties. The current theme is dark, broadly inspired by Claude's interface:

```css
--bg: #212121
--surface: #2f2f2f
--accent: #cc785c       /* warm coral */
--text: #ececec
--text-muted: #8e8ea0
```

Scrollbars are styled with `::-webkit-scrollbar` (works because Tauri uses a Chromium-based webview).

---

## Project Structure (Current State)

```
ai-hub/
├── src/
│   ├── App.tsx                        # State, wiring, layout
│   ├── types.ts                       # Shared TypeScript interfaces + helpers
│   ├── styles/
│   │   └── global.css                 # Design tokens, resets, scrollbar
│   ├── components/
│   │   ├── Chat/
│   │   │   ├── InputBar.tsx           # Auto-resize textarea, send button
│   │   │   ├── MessageBubble.tsx      # User + assistant message rendering
│   │   │   └── MessageList (removed)  # Replaced by MessageBubble directly
│   │   ├── Meters/
│   │   │   └── TokenCounter.tsx       # Live estimate + real usage display
│   │   └── Sidebar/
│   │       └── ModelPicker.tsx        # Live model list from OpenRouter API
│   └── lib/
│       └── tokenizer.ts               # gpt-tokenizer wrapper
│
└── src-tauri/src/
    ├── lib.rs                         # All Rust logic: chat, fetch_models, types
    ├── main.rs                        # Entry point → ai_hub_lib::run()
    └── build.rs                       # tauri_build::build()
```

---

## Known Issues and Edge Cases

**Duplicate event listeners** — Fixed. Previously, rapid sends would stack `chat-token` listeners causing doubled output. Now unlisten refs are cleaned up at the start of each send.

**Silent HTTP errors** — Fixed. A 402 (insufficient credits) or 401 (bad API key) would previously return nothing. The Rust command now checks `response.status().is_success()` before streaming and returns the error body as a Rust `Err`.

**Free model rate limits** — Not a bug. Free tier models on OpenRouter share capacity across all users. A 429 from a free model means the upstream provider is rate-limited. Solution is to retry, add a provider key, or use a paid model.

**API key in state** — The API key is held in React state and lost on every reload. This is a temporary measure. The intended solution is the OS keychain via Rust's `keyring` crate (see roadmap below).

---

## What Still Needs Building

### High Priority

**OS Keychain for API Key storage**
The API key input in the header is a placeholder. The `keyring` crate is already in the project spec. This means:
- A Tauri command `save_key(key: String)` that writes to the OS credential store
- A Tauri command `get_key()` that reads it back on startup
- Remove the visible API key input from the header entirely

**Conversation History (IndexedDB)**
Currently all conversations are lost when the app closes. The spec calls for `idb` (IndexedDB wrapper library):
- Auto-save every message to a `Conversation` object in IndexedDB
- Load conversations on startup and display them in a sidebar list
- Each conversation stores its `modelId`, `messages`, `totalCost`, and `totalTokens`

**Sidebar + Conversation List**
The left sidebar (planned in the spec) should show past conversations grouped by date, with titles auto-generated from the first user message.

### Medium Priority

**History Trimming**
The full message history is re-sent on every turn, which means input token costs grow with conversation length. The spec describes a sliding window trim in Rust:
- Keep system message + most recent messages within a token budget
- Budget defaults to 50% of the model's context window
- Prevents runaway costs on long conversations

**System Prompt Support**
No way to set a system prompt currently. Should be a collapsible panel or settings drawer with a textarea that prepends a `{ role: 'system', content }` message to every request.

**Ollama (Local Models)**
The spec includes an Ollama adapter for local models (`http://localhost:11434/api/chat`). This means:
- A second Rust adapter alongside the OpenRouter one
- Checking if Ollama is running before showing local models in the picker
- Gracefully hiding local models if the Ollama server is unreachable

**Configurable `max_tokens`**
Currently hardcoded to `1024`. Should be a per-model or per-conversation setting, or at minimum configurable in a settings panel.

### Lower Priority

**Markdown Rendering**
Assistant responses are rendered as plain text. Code blocks, bullet points, and bold text from the AI come through as raw markdown syntax. A lightweight renderer like `marked` or `react-markdown` would significantly improve readability.

**Message-level Token Counts**
The spec's `Message` interface includes `tokenCount` and `cost` per message. These could be shown on hover for granular cost visibility.

**Export / Copy**
No way to copy a full conversation or export it as markdown or plain text.

**Settings Panel**
A dedicated settings view for API key management, default model, `max_tokens`, theme (light/dark), and token budget configuration.

**Error Recovery UI**
Errors currently appear as plain red text. A proper retry button and clearer error messaging (especially distinguishing auth errors from rate limits from network failures) would improve the experience.

---

## Build Order (Remaining)

Following the original spec priority:

1. **OS Keychain** — unblock API key security, remove the header input
2. **IndexedDB persistence** — conversations survive app restarts
3. **Sidebar + Conversation list** — makes the app feel complete
4. **History trimming** — cost control on long conversations
5. **Markdown rendering** — major quality-of-life improvement
6. **System prompt support** — unlocks practical use cases
7. **Ollama adapter** — local model support
8. **Settings panel** — consolidate all configuration