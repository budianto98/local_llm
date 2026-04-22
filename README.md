# Local LLM Assistant UI Tester

Simple stateless chat app for trying local and remote LLMs with a left-side model picker.

## Features

- Left pane model selector.
- Stateless chat (no memory): each request sends only the latest user prompt.
- Supports both:
  - OpenAI-compatible endpoints (`/v1/chat/completions`)
  - Ollama native endpoint (`/api/chat`)
- Preloaded with your OpenAI-compatible model list plus Ollama Qwen2.5-Coder.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Optional API keys (only needed for hosted providers like Gemini/Perplexity/Poe):

```bash
cp .env.example .env.local
```

3. Run dev server:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## Important Notes

- Model config lives in `src/lib/models.ts`.
- Gemini API key is read from `GEMINI_API_KEY`.
- Perplexity API key is read from `PERPLEXITY_API_KEY`.
- Poe API key is read from `POE_API_KEY`.
- `EMPTY` and `YOUR_*` key placeholders are treated as "no Authorization header".

## Stateless Behavior

The backend route `src/app/api/chat/route.ts` only sends this message array:

```ts
[{ role: "user", content: message }]
```

No prior chat history is sent upstream.
