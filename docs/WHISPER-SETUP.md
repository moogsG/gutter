# Whisper Setup

Gutter uses [whisper.cpp](https://github.com/ggerganov/whisper.cpp) for local voice transcription. Speak into your microphone, get journal entries. No cloud APIs, no data leaving your machine.

---

## Prerequisites

- **ffmpeg** — required for audio format conversion
- **whisper.cpp** — the transcription engine
- A microphone (built-in or external)

---

## Install ffmpeg

### macOS

```bash
brew install ffmpeg
```

### Linux (Ubuntu/Debian)

```bash
sudo apt install ffmpeg
```

### Verify

```bash
ffmpeg -version
```

---

## Install whisper.cpp

### Option 1: Build from Source (Recommended)

```bash
git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp
make
```

On Apple Silicon, use Metal acceleration:

```bash
make WHISPER_METAL=1
```

### Option 2: Homebrew (macOS)

```bash
brew install whisper-cpp
```

---

## Download a Model

Models are stored as `.bin` files. Smaller = faster, larger = more accurate.

| Model | Size | Speed | Accuracy | Use Case |
|-------|------|-------|----------|----------|
| `tiny.en` | 75MB | Fastest | Basic | Quick notes, clear audio |
| `base.en` | 142MB | Fast | Good | **Recommended default.** Daily use. |
| `small.en` | 466MB | Medium | Better | Important transcriptions |
| `medium.en` | 1.5GB | Slow | Great | Meeting transcripts |

### Download

```bash
# Create cache directory
mkdir -p ~/.cache/whisper

# Download base.en (recommended)
curl -L -o ~/.cache/whisper/ggml-base.en.bin \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin

# Or download tiny.en (fastest)
curl -L -o ~/.cache/whisper/ggml-tiny.en.bin \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin
```

### Using the whisper.cpp Download Script

If you built from source:

```bash
cd whisper.cpp
bash models/download-ggml-model.sh base.en
# Model saved to: models/ggml-base.en.bin
cp models/ggml-base.en.bin ~/.cache/whisper/
```

---

## Configure in Gutter

Add to your `.env`:

```bash
# Path to the whisper model file
WHISPER_MODEL_PATH=~/.cache/whisper/ggml-base.en.bin
```

---

## How It Works in Gutter

1. Click the microphone icon in the journal entry form
2. Speak your entry
3. Audio is recorded in the browser as WebM
4. Sent to `/api/journal/transcribe` endpoint
5. Server converts to WAV via ffmpeg
6. whisper.cpp transcribes locally
7. Text appears in the entry field

The entire pipeline is local. Audio files are temporary and deleted after transcription.

---

## Troubleshooting

### "Whisper model not found"

Check the path in your `.env`:

```bash
ls -la ~/.cache/whisper/ggml-base.en.bin
```

If the file doesn't exist, download it (see above).

### "ffmpeg not found"

Install ffmpeg:

```bash
# macOS
brew install ffmpeg

# Linux
sudo apt install ffmpeg
```

### Poor transcription quality

- Use a larger model (`small.en` or `medium.en`)
- Reduce background noise
- Speak clearly and at a normal pace
- Use an external microphone instead of laptop built-in

### Slow transcription

- Use a smaller model (`tiny.en` or `base.en`)
- On Apple Silicon: rebuild whisper.cpp with Metal (`make WHISPER_METAL=1`)
- Close other CPU-heavy applications

### Non-English languages

The `.en` models are English-only but faster. For multilingual support, use the non-English variants:

```bash
curl -L -o ~/.cache/whisper/ggml-base.bin \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin
```

Update `.env`:

```bash
WHISPER_MODEL_PATH=~/.cache/whisper/ggml-base.bin
```
