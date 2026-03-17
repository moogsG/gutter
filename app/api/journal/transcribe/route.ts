import { execSync } from "node:child_process";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type NextRequest, NextResponse } from "next/server";

const WHISPER_MODEL = join(
	process.env.HOME || "/Users/moogs",
	".cache/whisper/ggml-base.en.bin",
);

export async function POST(req: NextRequest) {
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

		// Write uploaded audio to temp file
		const buffer = Buffer.from(await audioFile.arrayBuffer());
		const tempInput = join(tmpdir(), `journal-voice-${Date.now()}.webm`);
		const tempWav = join(tmpdir(), `journal-voice-${Date.now()}.wav`);
		tempFiles.push(tempInput, tempWav);

		writeFileSync(tempInput, buffer);

		// Convert to 16kHz mono WAV (whisper-cpp requirement)
		try {
			execSync(
				`ffmpeg -y -i "${tempInput}" -ar 16000 -ac 1 -c:a pcm_s16le "${tempWav}" 2>/dev/null`,
				{ timeout: 10000 },
			);
		} catch {
			return NextResponse.json(
				{ error: "Failed to convert audio format" },
				{ status: 500 },
			);
		}

		// Run whisper-cpp
		let transcript = "";
		try {
			const output = execSync(
				`whisper-cli -m "${WHISPER_MODEL}" -f "${tempWav}" --no-timestamps --no-prints 2>/dev/null`,
				{ timeout: 30000, encoding: "utf-8" },
			);
			transcript = output.trim();
		} catch {
			// Fallback: try without --no-prints and filter output
			try {
				const output = execSync(
					`whisper-cli -m "${WHISPER_MODEL}" -f "${tempWav}" --no-timestamps 2>&1`,
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
