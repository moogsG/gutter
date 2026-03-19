# LLM Provider Configuration

Gutter's AI features (meeting prep, natural language commands) use a **provider-agnostic LLM router** that supports multiple backends.

---

## Supported Providers

| Provider | Local/Cloud | Tool Calling | Cost | Setup Difficulty |
|----------|-------------|--------------|------|------------------|
| **Ollama** | Local | ✅ Yes | Free | Easy |
| **OpenAI** | Cloud | ✅ Yes | Paid | Easy |
| **Anthropic** | Cloud | ✅ Yes | Paid | Easy |
| **Google Gemini** | Cloud | ❌ No* | Paid | Easy |

\* Gemini tool calling not yet implemented in the router (contributions welcome!)

---

## Quick Start

### Option 1: Ollama (Default, Local)

**Best for:** Privacy, offline use, no API costs

1. Install Ollama:
   ```bash
   curl -fsSL https://ollama.com/install.sh | sh
   ```

2. Pull a model:
   ```bash
   ollama pull llama3.1:8b
   # or for better quality:
   ollama pull llama3.3:70b
   ```

3. Set environment variables (optional, defaults work):
   ```bash
   LLM_PROVIDER=ollama
   LLM_MODEL=llama3.1:8b
   LLM_BASE_URL=http://localhost:11434
   ```

4. Done! Gutter will use Ollama for all AI features.

---

### Option 2: OpenAI (GPT-4o)

**Best for:** High quality, reliable performance, easy setup

1. Get an API key: https://platform.openai.com/api-keys

2. Set environment variables:
   ```bash
   LLM_PROVIDER=openai
   LLM_MODEL=gpt-4o
   LLM_API_KEY=sk-...
   ```

3. Done! API calls will be made to OpenAI.

**Recommended models:**
- `gpt-4o` — Best overall (multimodal, fast, affordable)
- `gpt-4o-mini` — Cheaper, still very good
- `gpt-4-turbo` — Slightly better reasoning (more expensive)

---

### Option 3: Anthropic (Claude)

**Best for:** Best reasoning, tool use, long context

1. Get an API key: https://console.anthropic.com/settings/keys

2. Set environment variables:
   ```bash
   LLM_PROVIDER=anthropic
   LLM_MODEL=claude-sonnet-4
   LLM_API_KEY=sk-ant-...
   ```

3. Done! API calls will be made to Anthropic.

**Recommended models:**
- `claude-sonnet-4` — Best balance of speed/quality
- `claude-opus-4` — Best quality (slower, more expensive)
- `claude-3-5-haiku-20241022` — Fastest, cheapest

---

### Option 4: Google Gemini

**Best for:** Low cost, fast responses

1. Get an API key: https://aistudio.google.com/app/apikey

2. Set environment variables:
   ```bash
   LLM_PROVIDER=google
   LLM_MODEL=gemini-2.0-flash-exp
   LLM_API_KEY=AIza...
   ```

3. Done! API calls will be made to Google.

**Note:** Tool calling not yet supported for Gemini. Meeting prep will work, but tool features (Jira/Slack search) will be limited.

**Recommended models:**
- `gemini-2.0-flash-exp` — Fast, experimental
- `gemini-1.5-pro` — Best quality

---

## Environment Variables Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `LLM_PROVIDER` | Provider name (`ollama`, `openai`, `anthropic`, `google`) | `ollama` |
| `LLM_MODEL` | Model identifier (provider-specific) | See provider defaults |
| `LLM_API_KEY` | API key (cloud providers only) | None |
| `LLM_BASE_URL` | Custom base URL (for Ollama or proxies) | Provider default |

---

## Model Recommendations by Use Case

### For Local/Offline Use
- **Best:** Ollama + `llama3.3:70b` (requires 48GB+ RAM/VRAM)
- **Good:** Ollama + `llama3.1:8b` (runs on 8GB RAM)
- **Budget:** Ollama + `phi3:mini` (runs on 4GB RAM)

### For Cost Efficiency
- **Best:** Anthropic `claude-3-5-haiku-20241022` ($0.25/1M input tokens)
- **Good:** OpenAI `gpt-4o-mini` ($0.15/1M input tokens)
- **Budget:** Google `gemini-2.0-flash-exp` (free tier available)

### For Best Quality
- **Best:** Anthropic `claude-opus-4` (most capable reasoning)
- **Good:** OpenAI `gpt-4o` (excellent all-rounder)
- **Budget:** Anthropic `claude-sonnet-4` (great balance)

### For Speed
- **Best:** Google `gemini-2.0-flash-exp` (~200ms responses)
- **Good:** OpenAI `gpt-4o-mini` (~500ms responses)
- **Local:** Ollama `llama3.1:8b` (~2-5s on GPU)

---

## Switching Providers

You can switch providers at any time by changing the `LLM_PROVIDER` environment variable and restarting Gutter:

```bash
# Switch from Ollama to OpenAI
export LLM_PROVIDER=openai
export LLM_API_KEY=sk-...
bun run dev

# Switch back to Ollama
export LLM_PROVIDER=ollama
bun run dev
```

No code changes required!

---

## Advanced: Custom Endpoints

### Using a Local OpenAI-Compatible Server

Many local inference servers (e.g., LM Studio, LocalAI, vLLM) expose an OpenAI-compatible API:

```bash
LLM_PROVIDER=openai
LLM_BASE_URL=http://localhost:1234/v1
LLM_MODEL=your-model-name
# No API key needed for local servers
```

### Using a Proxy or Router

If you're using a proxy like LiteLLM or RouteLLM:

```bash
LLM_PROVIDER=openai  # or anthropic, depending on proxy format
LLM_BASE_URL=http://your-proxy:8000
LLM_API_KEY=your-proxy-key
```

---

## Cost Estimates (Typical Meeting Prep)

Assuming ~2,000 input tokens + ~500 output tokens per meeting prep request:

| Provider | Model | Cost per Prep | 100 Preps/Month |
|----------|-------|---------------|-----------------|
| Ollama | llama3.1:8b | $0.00 | $0.00 |
| OpenAI | gpt-4o-mini | $0.001 | $0.10 |
| OpenAI | gpt-4o | $0.006 | $0.60 |
| Anthropic | claude-3-5-haiku | $0.001 | $0.10 |
| Anthropic | claude-sonnet-4 | $0.006 | $0.60 |
| Anthropic | claude-opus-4 | $0.030 | $3.00 |
| Google | gemini-2.0-flash | $0.000 | $0.00 (free tier) |

---

## Troubleshooting

### "LLM API error: 401"
- **Cause:** Invalid or missing API key
- **Fix:** Check `LLM_API_KEY` is set correctly

### "LLM API error: 404"
- **Cause:** Invalid model name
- **Fix:** Check `LLM_MODEL` matches provider's available models

### "Ollama API error: Connection refused"
- **Cause:** Ollama is not running
- **Fix:** Start Ollama: `ollama serve` or check if it's running: `curl http://localhost:11434`

### Tool calls not working
- **Cause:** Provider doesn't support tool calling (e.g., Gemini)
- **Fix:** Switch to Ollama, OpenAI, or Anthropic for full tool support

---

## Contributing

Want to add support for another provider (e.g., Cohere, Mistral, Groq)?

1. Add provider logic to `lib/llm-router.ts`
2. Add provider-specific documentation here
3. Add tests in `__tests__/lib/llm-router.test.ts`
4. Submit a PR!

See `lib/llm-router.ts` for the interface and existing implementations.
