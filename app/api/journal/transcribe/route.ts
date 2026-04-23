import { execSync } from "node:child_process";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import { rateLimitMiddleware } from "@/lib/rate-limit";

const WHISPER_MODEL = join(
	process.env.HOME || "/Users/moogs",
	".cache/whisper/ggml-base.en.bin",
);

// Use absolute paths for binaries so they work regardless of the process PATH
// (LaunchAgent environments often have a restricted PATH that excludes /opt/homebrew/bin)
const FFMPEG_BIN = existsSync("/opt/homebrew/bin/ffmpeg")
	? "/opt/homebrew/bin/ffmpeg"
	: "ffmpeg";
const WHISPER_BIN = existsSync("/opt/homebrew/bin/whisper-cli")
	? "/opt/homebrew/bin/whisper-cli"
	: "whisper-cli";

export async function POST(req: NextRequest) {
	// Rate limit: 10 requests per minute (CPU-intensive transcription)
	const limited = rateLimitMiddleware(req, {
		windowMs: 60000,
		maxRequests: 10,
	});
	if (limited) return limited;

	const tempFiles: string[] = [];

	try {
		const formData = await req.formData();
		const audioFile = formData.get("audio") as File | null;

		if (!audioFile) {
			return NextResponse.json(
				{ error: "No audio file provided" },
				{ status: 400 },
			);
		}

		// Write uploaded audio to temp file, preserving a sane extension for browser-specific mime types
		const buffer = Buffer.from(await audioFile.arrayBuffer());
		const extension = audioFile.type.includes("mp4")
			? "mp4"
			: audioFile.type.includes("mpeg")
				? "mp3"
				: audioFile.type.includes("wav")
					? "wav"
					: "webm";
		const tempInput = join(tmpdir(), `journal-voice-${Date.now()}.${extension}`);
		const tempWav = join(tmpdir(), `journal-voice-${Date.now()}.wav`);
		tempFiles.push(tempInput, tempWav);

		writeFileSync(tempInput, buffer);

		// Convert to 16kHz mono WAV (whisper-cpp requirement)
		try {
			execSync(
				`"${FFMPEG_BIN}" -y -i "${tempInput}" -vn -ar 16000 -ac 1 -c:a pcm_s16le "${tempWav}"`,
				{ timeout: 10000, stdio: "pipe" },
			);
		} catch (error) {
			const detail = error instanceof Error ? error.message : String(error);
			console.error("Audio conversion failed:", detail);
			return NextResponse.json(
				{ error: "Failed to convert audio format", detail },
				{ status: 500 },
			);
		}

		// Run whisper-cpp
		let transcript = "";
		try {
			const output = execSync(
				`"${WHISPER_BIN}" -m "${WHISPER_MODEL}" -f "${tempWav}" --no-timestamps --no-prints 2>/dev/null`,
				{ timeout: 30000, encoding: "utf-8" },
			);
			transcript = output.trim();
		} catch (error) {
			console.error("Primary whisper transcription failed:", error);
			// Fallback: try without --no-prints and filter output
			try {
				const output = execSync(
					`"${WHISPER_BIN}" -m "${WHISPER_MODEL}" -f "${tempWav}" --no-timestamps 2>&1`,
					{ timeout: 30000, encoding: "utf-8" },
				);
				// Extract just the transcription lines (not whisper debug output)
				const lines = output
					.split("\n")
					.filter(
						(line) =>
							!line.startsWith("whisper_") &&
							!line.startsWith("ggml_") &&
							!line.startsWith("system_info") &&
							!line.startsWith("main:") &&
							!line.startsWith("output_") &&
							line.trim().length > 0,
					);
				transcript = lines.join(" ").trim();
			} catch (e2) {
				return NextResponse.json(
					{ error: "Transcription failed", detail: String(e2) },
					{ status: 500 },
				);
			}
		}

		return NextResponse.json({
			text: transcript,
			duration: audioFile.size, // approximate
		});
	} catch (error) {
		console.error("Transcription error:", error);
		return NextResponse.json(
			{ error: "Transcription failed" },
			{ status: 500 },
		);
	} finally {
		// Cleanup temp files
		for (const f of tempFiles) {
			try {
				if (existsSync(f)) unlinkSync(f);
			} catch {
				// ignore cleanup errors
			}
		}
	}
}
