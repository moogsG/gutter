import { afterEach, describe, expect, it, vi } from "vitest";
import {
	runTranscriptSummaryAgent,
	summarizeMeetingTranscript,
} from "@/lib/meeting-transcript";
import { resolveMeetingOccurrenceDate } from "@/lib/meeting-occurrence";

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllEnvs();
});

describe("runTranscriptSummaryAgent", () => {
	it("passes hostile meeting data as one inert message argument without a shell", async () => {
		const hostileTranscript = "$(touch /tmp/pwned) `touch /tmp/also-pwned` \"quoted\" 'single'\nnext line";
		const runProcess = vi.fn().mockResolvedValue({ stdout: "{}", stderr: "" });

		await runTranscriptSummaryAgent(
			{
				eventId: "event-$(id)",
				title: "Planning `whoami`",
				time: "2026-09-01T23:30:00-05:00\n--help",
				occurrenceDate: "2026-09-01",
				transcript: hostileTranscript,
			},
			runProcess,
		);

		expect(runProcess).toHaveBeenCalledTimes(1);
		const [file, args, options] = runProcess.mock.calls[0];
		expect(file).toBe("openclaw");
		expect(options).toMatchObject({ shell: false });
		expect(args).toEqual([
			"agent",
			"--agent",
			"main",
			"--message",
			expect.stringContaining(hostileTranscript),
			"--json",
		]);
		expect(args.filter((argument: string) => argument.includes("touch /tmp"))).toHaveLength(1);
	});
});

describe("summarizeMeetingTranscript", () => {
	it("persists the parsed summary in-process when authentication is enabled", async () => {
		vi.stubEnv("AUTH_PASSWORD_HASH", "configured-password-hash");
		const fetchSpy = vi.spyOn(globalThis, "fetch");
		const updateMeetingPrep = vi.fn().mockReturnValue({ id: "meeting-1" });
		const runProcess = vi.fn().mockResolvedValue({
			stdout: JSON.stringify({
				status: "ok",
				result: {
					payloads: [
						{
							text: JSON.stringify({
								summary: "The team chose the safer process boundary.",
								actionItems: ["Ship the regression test"],
							}),
						},
					],
				},
			}),
			stderr: "",
		});

		await summarizeMeetingTranscript(
			{
				eventId: "event-1",
				title: "Security review",
				time: "2026-09-01T23:30:00-05:00",
				occurrenceDate: "2026-09-01",
				transcript: "We agreed to remove the loopback callback.",
			},
			{ runProcess, updateMeetingPrep },
		);

		expect(fetchSpy).not.toHaveBeenCalled();
		expect(updateMeetingPrep).toHaveBeenCalledWith({
			eventId: "event-1",
			occurrenceDate: "2026-09-01",
			summary: "The team chose the safer process boundary.",
			actionItems: ["Ship the regression test"],
		});
	});
});

describe("resolveMeetingOccurrenceDate", () => {
	it("preserves the supplied local occurrence date for a late-evening event", () => {
		expect(
			resolveMeetingOccurrenceDate({
				occurrenceDate: "2026-09-01",
				time: "2026-09-01T23:30:00-05:00",
			}),
		).toBe("2026-09-01");
	});
});
