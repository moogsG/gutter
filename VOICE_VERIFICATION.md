# Voice Capture Verification Checklist

## Prerequisites
✓ ffmpeg installed at `/opt/homebrew/bin/ffmpeg`
✓ whisper-cli installed at `/opt/homebrew/bin/whisper-cli`
✓ Whisper model at `~/.cache/whisper/ggml-base.en.bin`

## Desktop Testing (macOS/Chrome)

### 1. Basic Voice Button (EntryInput/CaptureDialog)
- [ ] Click mic button in text input
- [ ] Browser prompts for microphone access (first time)
- [ ] Button turns red and pulses while recording
- [ ] Speak clearly for 2-3 seconds
- [ ] Click stop (square icon) to finish
- [ ] Transcription appears in text field within 2-3 seconds
- [ ] No errors in console

### 2. Quick Voice Button (ConversationalTranscript)
- [ ] Open capture dialog (Cmd+Shift+C)
- [ ] Start a conversation (type or voice)
- [ ] After 2+ exchanges, quick voice button appears (bottom-right)
- [ ] Press and HOLD the circular button
- [ ] Button scales up, changes color, shows "Release to send"
- [ ] Speak clearly while holding
- [ ] Release to transcribe and send immediately
- [ ] Message appears in conversation within 2-3 seconds

### 3. Keyboard Shortcuts
- [ ] Press Cmd+K to open command palette
- [ ] Press Cmd+Shift+C to open capture dialog
- [ ] Press ? to open keyboard shortcuts modal
- [ ] Verify "Capture" section shows:
  - Cmd+Shift+C for quick capture
  - Cmd+Shift+V for voice capture

## Mobile Testing (iOS Safari)

### 1. Touch Interaction
- [ ] Tap mic button in text input
- [ ] iOS prompts for microphone access (first time)
- [ ] Button visual feedback on tap
- [ ] Recording starts immediately
- [ ] Tap again to stop
- [ ] Transcription appears

### 2. Press-and-Hold (Quick Voice)
- [ ] Open capture dialog
- [ ] Start conversation to reveal quick voice button
- [ ] Touch and HOLD the button (not tap)
- [ ] Button scales up and shows recording state
- [ ] Speak while holding
- [ ] Release to transcribe and send
- [ ] No accidental context menu (long press)
- [ ] Works with drag-off (release outside button area)

### 3. Mobile Layout
- [ ] Capture dialog fills screen appropriately (90vh)
- [ ] Quick voice button positioned correctly (-bottom-6)
- [ ] No horizontal scrolling
- [ ] Text input resizes properly
- [ ] Keyboard doesn't cover input

## API Integration Testing

### 1. Transcription Endpoint
```bash
# Test with sample audio file
curl -X POST http://localhost:3000/api/journal/transcribe \
  -F "audio=@test-voice.webm"
```

Expected response:
```json
{
  "text": "transcribed text here",
  "duration": 12345
}
```

### 2. Process Endpoint (Organize Mode)
```bash
curl -X POST http://localhost:3000/api/journal/transcript/process \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Call mom at 3pm. Buy groceries. Remember project deadline Friday.",
    "mode": "organize",
    "date": "2026-04-15"
  }'
```

Expected: 3 entries created (appointment, task, note)

### 3. Process Endpoint (Talk Mode)
```bash
curl -X POST http://localhost:3000/api/journal/transcript/process \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Had a great meeting with the team today. Everyone was engaged and we made solid progress.",
    "mode": "talk",
    "date": "2026-04-15"
  }'
```

Expected: 1 conversational entry (note signifier)

## Known Issues & Workarounds

### Safari mime type fallback
- VoiceButton and QuickVoiceButton now detect Safari and use `audio/mp4` if `audio/webm` is unsupported

### Mobile context menu
- `onContextMenu` handler prevents long-press menu on recording button
- `touch-none` CSS class prevents accidental text selection

### Short recordings
- Both buttons ignore recordings shorter than 1000 bytes (< 1 second)
- This prevents accidental clicks from creating empty transcriptions

## Performance Expectations

- **Recording start**: < 300ms (microphone access)
- **Transcription time**: 1-3 seconds for 10-second audio
- **Total capture flow**: 5-8 seconds from press to entry created

## Error Handling

### No microphone permission
- Console shows: "Microphone access error"
- Button returns to idle state
- User can try again (browser will re-prompt)

### Transcription failure
- Console shows: "Voice transcription error"
- Toast notification (optional, add if needed)
- Button returns to idle, user can retry

### Network timeout
- 30-second timeout on whisper-cpp execution
- API returns 500 with error detail
- Client catches and logs error
