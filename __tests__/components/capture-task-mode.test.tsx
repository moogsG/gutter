import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCaptureChat } from "@/hooks/useCaptureChat";

describe("useCaptureChat task mode", () => {
	beforeEach(() => {
		localStorage.clear();
		vi.clearAllMocks();
	});

	it("forces task capture through organize mode", async () => {
		const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => ({
			ok: true,
			json: async () => ({ entries: [], conversational: { aiResponse: "Got it" } }),
		}) as Response);
		vi.stubGlobal("fetch", fetchMock);
		const { result } = renderHook(() => useCaptureChat("2026-09-02", undefined, "task"));

		act(() => {
			result.current.handleInputChange({
				target: { value: "Submit expenses", style: {}, scrollHeight: 24 },
			} as any);
		});
		await act(async () => { await result.current.handleSubmit(); });
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		const request = fetchMock.mock.calls[0][1] as RequestInit;
		const body = JSON.parse(String(request.body));

		expect(body).toMatchObject({
			mode: "organize",
			text: "Create a task: Submit expenses",
			date: "2026-09-02",
		});
	});
});
