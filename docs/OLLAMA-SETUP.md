# Ollama Setup

Gutter uses [Ollama](https://ollama.com) for all AI features — natural language commands, meeting prep, transcript summaries, and AI triage. Everything runs locally. No API keys, no cloud, no data leaving your machine.

---

## Install Ollama

### macOS

```bash
brew install ollama
```

Or download from [ollama.com/download](https://ollama.com/download).

### Linux

```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

### Verify

```bash
ollama --version
ollama serve  # Start the server (runs on port 11434)
```

---

## Pull a Model

Gutter needs a model that supports **tool calling** (function calling). This is critical for the natural language command parser.

### Recommended Models

| Model | Size | RAM Needed | Tool Calling | Notes |
|-------|------|------------|-------------|-------|
| `qwen3:latest` | ~5GB | 8GB+ | Yes | **Default.** Best balance of quality and speed. |
| `qwen3:8b` | ~5GB | 8GB+ | Yes | Explicit 8B variant. |
| `qwen3:1.7b` | ~1.5GB | 4GB+ | Yes | Lightweight. Good for older hardware. |
| `llama3.2:latest` | ~2GB | 4GB+ | Yes | Fast, decent quality. |
| `mistral:latest` | ~4GB | 8GB+ | Partial | Works but less reliable tool calling. |

### Pull Your Model

```bash
# Default (recommended)
ollama pull qwen3

# Lightweight alternative
ollama pull qwen3:1.7b

# If you have plenty of RAM
ollama pull qwen3:14b
```

---

## Configure in Gutter

Add to your `.env`:

```bash
# Ollama server URL (default: http://localhost:11434)
OLLAMA_URL=http://localhost:11434

# Model for AI features (meeting prep, summaries, triage)
OLLAMA_MODEL=qwen3:latest

# Model for natural language command parsing (needs tool calling)
JOURNAL_COMMAND_MODEL=qwen3:latest
```

You can use different models for different features. For example, a larger model for meeting prep and a smaller one for command parsing:

```bash
OLLAMA_MODEL=qwen3:14b
JOURNAL_COMMAND_MODEL=qwen3:1.7b
```

---

## Hardware Requirements

| Setup | RAM | GPU | Experience |
|-------|-----|-----|------------|
| Minimum | 8GB | None (CPU) | Slow but works. 10-30s per response. |
| Recommended | 16GB | Apple Silicon / 6GB+ VRAM | Fast. 2-5s per response. |
| Ideal | 32GB+ | Apple Silicon / 12GB+ VRAM | Near-instant. Sub-second for small models. |

### Apple Silicon Notes

Ollama uses the Metal GPU on Apple Silicon Macs automatically. No configuration needed. M1/M2/M3 with 16GB+ unified memory handles most models well.

### Linux GPU

For NVIDIA GPUs, Ollama uses CUDA automatically if drivers are installed. For AMD, ROCm support is available but less tested.

---

## Verify It Works

```bash
# Check Ollama is running
curl http://localhost:11434/api/tags

# Test a prompt
curl http://localhost:11434/api/generate -d '{
  "model": "qwen3",
  "prompt": "Say hello",
  "stream": false
}'
```

---

## Troubleshooting

### "Connection refused" errors

Ollama server isn't running:

```bash
ollama serve
```

Or on macOS, make sure the Ollama app is running (check menu bar).

### Slow responses

- Use a smaller model (`qwen3:1.7b`)
- Close other memory-heavy apps
- Check `Activity Monitor` / `htop` for memory pressure

### "Model not found"

```bash
ollama list          # See what's installed
ollama pull qwen3    # Pull the model
```

### Tool calling not working

Some models don't support tool/function calling. Stick with `qwen3` or `llama3.2` for reliable command parsing. If commands aren't being parsed correctly, check `JOURNAL_COMMAND_MODEL` is set to a tool-calling model.

---

## Running Ollama as a Service

### macOS

The Ollama desktop app runs as a menu bar service automatically.

### Linux (systemd)

```bash
sudo systemctl enable ollama
sudo systemctl start ollama
```

### Docker

```bash
docker run -d -v ollama:/root/.ollama -p 11434:11434 --name ollama ollama/ollama
docker exec ollama ollama pull qwen3
```

If using Docker, update your `.env`:

```bash
OLLAMA_URL=http://localhost:11434
```
