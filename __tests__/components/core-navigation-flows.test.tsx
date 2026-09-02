import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const searchParams = new URLSearchParams();
const triggerSearch = vi.fn(() => ({ unwrap: async () => [] }));
const triggerSemantic = vi.fn(() => ({ unwrap: async () => [] }));
const getCollectionQuery = vi.fn(() => ({
	data: {
		id: "col-reading",
		title: "Reading",
		created_at: "2026-09-02T12:00:00.000Z",
		entries: [{ id: "entry-1", date: "2026-09-02", signifier: "note", text: "Read chapter", status: "open" }],
	},
	isLoading: false,
}));

vi.mock("next/navigation", () => ({
	useParams: () => ({ date: "2026-09-02" }),
	useRouter: () => ({ push }),
	useSearchParams: () => searchParams,
}));

vi.mock("cmdk", () => ({
	Command: {
		Dialog: ({ open, children }: any) => open ? <div role="dialog">{children}</div> : null,
		Input: ({ value, onValueChange, placeholder }: any) => (
			<input value={value} onChange={(event) => onValueChange(event.target.value)} placeholder={placeholder} />
		),
		List: ({ children }: any) => <div>{children}</div>,
		Empty: ({ children }: any) => <div>{children}</div>,
		Group: ({ children }: any) => <div>{children}</div>,
		Item: ({ value, onSelect, children }: any) => (
			<button type="button" onClick={() => onSelect(value)}>{children}</button>
		),
	},
}));

vi.mock("@radix-ui/react-dialog", () => ({
	Title: ({ children }: any) => <span>{children}</span>,
	Description: ({ children }: any) => <span>{children}</span>,
}));

vi.mock("@/store/api/journalApi", () => ({
	journalApi: {
		util: { invalidateTags: vi.fn() },
		endpoints: { getEntries: { initiate: vi.fn() } },
	},
	useGetEntriesQuery: () => ({ data: [], isLoading: false }),
	useAddEntryMutation: () => [vi.fn()],
	useUpdateEntryMutation: () => [vi.fn()],
	useDeleteEntryMutation: () => [vi.fn()],
	useMigrateEntriesMutation: () => [vi.fn()],
	useLazySearchEntriesQuery: () => [triggerSearch],
	useLazySemanticSearchQuery: () => [triggerSemantic],
	useGetCollectionQuery: getCollectionQuery,
}));

vi.mock("@/store/store", () => ({ useAppDispatch: () => vi.fn() }));
vi.mock("@/components/journal/JournalHeader", () => ({ JournalHeader: () => <header /> }));
vi.mock("@/components/journal/EntryInput", () => ({ EntryInput: () => <div /> }));
vi.mock("@/components/journal/EntryItem", () => ({ EntryItem: () => <div /> }));
vi.mock("@/components/journal/VoiceButton", () => ({ VoiceButton: () => <button type="button">Voice</button> }));
vi.mock("@/components/journal/TodayFocus", () => ({ TodayFocus: () => <div /> }));
vi.mock("@/components/journal/MorningView", () => ({ MorningView: () => <div /> }));
vi.mock("@/components/journal/EmptyTodayPrompt", () => ({ EmptyTodayPrompt: () => <div /> }));
vi.mock("@/components/journal/CaptureDialog", () => ({
	CaptureDialog: ({ open, captureMode }: any) => open ? <div role="dialog" data-capture-mode={captureMode} /> : null,
}));

describe("core navigation flows", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		searchParams.delete("capture");
		window.history.replaceState({}, "", "/");
	});

	it("loads calendar and meeting prep only once for a date across rerenders", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			return {
				ok: true,
				json: async () => url.includes("calendar") ? [] : { meetings: [] },
			} as Response;
		});
		vi.stubGlobal("fetch", fetchMock);
		const { default: DayDetailPage } = await import("@/app/day/[date]/page");

		const view = render(<DayDetailPage />);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
		view.rerender(<DayDetailPage />);
		await act(async () => { await new Promise((resolve) => setTimeout(resolve, 25)); });

		expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("/api/calendar/events"))).toHaveLength(1);
		expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/api/meeting-prep"))).toHaveLength(1);
	});

	it("navigates date selections directly to the authoritative day URL", async () => {
		const dispatchEvent = vi.spyOn(window, "dispatchEvent");
		const { OmniBar } = await import("@/components/journal/OmniBar");
		render(<OmniBar />);

		fireEvent.keyDown(document, { key: "k", metaKey: true });
		fireEvent.change(screen.getByPlaceholderText(/Navigate, search entries/), {
			target: { value: "2026-09-03" },
		});
		fireEvent.click(screen.getByRole("button", { name: /Go to/ }));

		expect(push).toHaveBeenCalledWith("/day/2026-09-03");
		expect(dispatchEvent).not.toHaveBeenCalled();
	});

	it("opens the root capture dialog in task mode for ?capture=task", async () => {
		window.history.replaceState({}, "", "/?capture=task");
		const { default: JournalPage } = await import("@/app/page");

		render(<JournalPage />);

		expect(await screen.findByRole("dialog")).toHaveAttribute("data-capture-mode", "task");
	});

	it("loads a collection page through its id-backed detail path", async () => {
		const { default: CollectionPage } = await import("@/app/collections/[id]/page");
		await act(async () => {
			render(<CollectionPage params={Promise.resolve({ id: "col-reading" })} />);
		});

		await waitFor(() => expect(getCollectionQuery).toHaveBeenCalledWith("col-reading"));
		expect(await screen.findByRole("heading", { name: "Reading" })).toBeInTheDocument();
		expect(screen.getByText("Read chapter")).toBeInTheDocument();
	});
});
