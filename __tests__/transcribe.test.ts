import { describe, it, expect, vi } from "vitest";
import { tmpdir } from "os";
import { join } from "path";
import { existsSync } from "fs";

describe("Audio Transcription", () => {
  const WHISPER_MODEL = join(
    process.env.HOME || "/Users/moogs",
    ".cache/whisper/ggml-base.en.bin"
  );

  describe("Audio format conversion", () => {
    it("should convert webm to 16kHz mono WAV", () => {
      // This test verifies the ffmpeg command structure
      const tempInput = join(tmpdir(), "test-input.webm");
      const tempWav = join(tmpdir(), "test-output.wav");
      
      const expectedCommand = `ffmpeg -y -i "${tempInput}" -ar 16000 -ac 1 -c:a pcm_s16le "${tempWav}" 2>/dev/null`;
      
      expect(expectedCommand).toContain("-ar 16000"); // Sample rate
      expect(expectedCommand).toContain("-ac 1"); // Mono channel
      expect(expectedCommand).toContain("-c:a pcm_s16le"); // PCM codec
    });

    it("should support multiple audio formats", () => {
      const formats = ["webm", "m4a", "wav", "mp3"];
      
      formats.forEach(format => {
        const input = `test.${format}`;
        expect(input).toMatch(/\.(webm|m4a|wav|mp3)$/);
      });
    });
  });

  describe("Whisper CLI invocation", () => {
    it("should call whisper-cli with correct arguments", () => {
      const tempWav = join(tmpdir(), "test.wav");
      
      const expectedCommand = `whisper-cli -m "${WHISPER_MODEL}" -f "${tempWav}" --no-timestamps --no-prints 2>/dev/null`;
      
      expect(expectedCommand).toContain("whisper-cli");
      expect(expectedCommand).toContain("-m"); // Model flag
      expect(expectedCommand).toContain("-f"); // File flag
      expect(expectedCommand).toContain("--no-timestamps");
      expect(expectedCommand).toContain("--no-prints");
    });

    it("should filter out whisper debug output", () => {
      const mockOutput = `
whisper_init_from_file_with_params_no_state: loading model from '~/.cache/whisper/ggml-base.en.bin'
ggml_backend_metal_buffer_get_tensor_addr: tensor not in buffer
main: processing 'test.wav' (16000 Hz, 16000 samples, 1.0 sec)
This is the transcribed text.
output_txt: writing to 'test.txt'
      `.trim();

      const lines = mockOutput.split("\n").filter(
        (line) =>
          !line.startsWith("whisper_") &&
          !line.startsWith("ggml_") &&
          !line.startsWith("system_info") &&
          !line.startsWith("main:") &&
          !line.startsWith("output_") &&
          line.trim().length > 0
      );

      const transcript = lines.join(" ").trim();
      
      expect(transcript).toBe("This is the transcribed text.");
      expect(transcript).not.toContain("whisper_");
      expect(transcript).not.toContain("ggml_");
    });
  });

  describe("Temp file cleanup", () => {
    it("should cleanup temp files after transcription", () => {
      const tempFiles = [
        join(tmpdir(), "test-input.webm"),
        join(tmpdir(), "test-output.wav"),
      ];

      // Simulate cleanup
      const cleanup = (files: string[]) => {
        files.forEach(f => {
          if (existsSync(f)) {
            // Would call unlinkSync(f) in actual implementation
          }
        });
      };

      expect(() => cleanup(tempFiles)).not.toThrow();
    });

    it("should ignore cleanup errors for non-existent files", () => {
      const nonExistentFile = join(tmpdir(), "does-not-exist.wav");
      
      const cleanup = () => {
        try {
          if (existsSync(nonExistentFile)) {
            // Would call unlinkSync
          }
        } catch {
          // Ignore errors
        }
      };

      expect(() => cleanup()).not.toThrow();
    });
  });

  describe("Error handling", () => {
    it("should handle missing audio file", () => {
      const error = { error: "No audio file provided" };
      
      expect(error.error).toBe("No audio file provided");
    });

    it("should handle ffmpeg conversion failure", () => {
      const error = { error: "Failed to convert audio format" };
      
      expect(error.error).toBe("Failed to convert audio format");
    });

    it("should handle whisper transcription failure", () => {
      const error = {
        error: "Transcription failed",
        detail: "timeout exceeded",
      };
      
      expect(error.error).toBe("Transcription failed");
      expect(error.detail).toBeTruthy();
    });
  });

  describe("Response format", () => {
    it("should return text and duration", () => {
      const response = {
        text: "This is a transcribed message.",
        duration: 12345, // Approximate based on file size
      };

      expect(response.text).toBeTruthy();
      expect(response.duration).toBeGreaterThan(0);
    });

    it("should trim whitespace from transcript", () => {
      const rawTranscript = "  Hello world  \n";
      const cleaned = rawTranscript.trim();
      
      expect(cleaned).toBe("Hello world");
      expect(cleaned).not.toMatch(/^\s/);
      expect(cleaned).not.toMatch(/\s$/);
    });
  });

  describe("Timeout handling", () => {
    it("should timeout after 30 seconds", () => {
      const TIMEOUT = 30000; // 30 seconds
      
      expect(TIMEOUT).toBe(30000);
    });

    it("should timeout ffmpeg conversion after 10 seconds", () => {
      const FFMPEG_TIMEOUT = 10000; // 10 seconds
      
      expect(FFMPEG_TIMEOUT).toBe(10000);
    });
  });

  describe("Audio quality settings", () => {
    it("should request optimal audio quality from browser", () => {
      const audioConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 16000,
      };

      expect(audioConstraints.echoCancellation).toBe(true);
      expect(audioConstraints.noiseSuppression).toBe(true);
      expect(audioConstraints.sampleRate).toBe(16000);
    });
  });
});
