import { execFile } from "node:child_process";

export interface MeetingTranscriptInput {
	eventId: string;
	title: string;
	time: string;
	occurrenceDate: string;
	transcript: string;
}

interface ProcessOptions {
	shell: false;
	timeout: number;
	maxBuffer: number;
	encoding: "utf8";
}

interface ProcessOutput {
	stdout: string;
	stderr: string;
}

export type TranscriptProcessRunner = (
	file: string,
	args: string[],
	options: ProcessOptions,
) => Promise<ProcessOutput>;

interface TranscriptSummary {
	summary: string;
	actionItems: string[];
}

interface MeetingPrepSummaryUpdate extends TranscriptSummary {
	eventId: string;
	occurrenceDate: string;
}

const runExecFile: TranscriptProcessRunner = (file, args, options) =>
	new Promise((resolve, reject) => {
		execFile(file, args, options, (error, stdout, stderr) => {
			if (error) {
				reject(error);
				return;
			}
			resolve({ stdout, stderr });
		});
	});

function buildSummaryMessage(input: MeetingTranscriptInput): string {
	return `Summarize this meeting transcript and extract concrete action items.
Return only JSON with this exact shape: {"summary":"...","actionItems":["..."]}.
Do not call Gutter or any HTTP endpoint; the server will persist your result.

Event ID: ${input.eventId}
Title: ${input.title || "Meeting"}
Time: ${input.time || "Unknown time"}
Occurrence date: ${input.occurrenceDate}

Transcript:
${input.transcript.substring(0, 4000)}`;
}

export async function runTranscriptSummaryAgent(
	input: MeetingTranscriptInput,
	runProcess: TranscriptProcessRunner = runExecFile,
): Promise<ProcessOutput> {
	return runProcess(
		"openclaw",
		["agent", "--agent", "main", "--message", buildSummaryMessage(input), "--json"],
		{
			shell: false,
			timeout: 120_000,
			maxBuffer: 1024 * 1024,
			encoding: "utf8",
		},
	);
}

function parseJsonText(value: string): unknown {
	const trimmed = value.trim();
	const withoutFence = trimmed
		.replace(/^```(?:json)?\s*/i, "")
		.replace(/\s*```$/, "");
	return JSON.parse(withoutFence);
}

function parseTranscriptSummary(stdout: string): TranscriptSummary {
	const commandResult = parseJsonText(stdout) as {
		result?: { payloads?: Array<{ text?: string }> };
		summary?: unknown;
		actionItems?: unknown;
	};
	const payloadText = commandResult.result?.payloads
		?.map((payload) => payload.text)
		.find((text): text is string => Boolean(text));
	const result = (payloadText ? parseJsonText(payloadText) : commandResult) as {
		summary?: unknown;
		actionItems?: unknown;
	};

	if (
		typeof result.summary !== "string" ||
		!Array.isArray(result.actionItems) ||
		!result.actionItems.every((item) => typeof item === "string")
	) {
		throw new Error("Transcript summary agent returned an invalid result");
	}

	return { summary: result.summary, actionItems: result.actionItems };
}

export async function summarizeMeetingTranscript(
	input: MeetingTranscriptInput,
	dependencies: {
		runProcess?: TranscriptProcessRunner;
		updateMeetingPrep: (
			update: MeetingPrepSummaryUpdate,
		) => unknown | Promise<unknown>;
	},
): Promise<TranscriptSummary> {
	const { stdout } = await runTranscriptSummaryAgent(
		input,
		dependencies.runProcess,
	);
	const summary = parseTranscriptSummary(stdout);
	await dependencies.updateMeetingPrep({
		eventId: input.eventId,
		occurrenceDate: input.occurrenceDate,
		...summary,
	});
	return summary;
}
