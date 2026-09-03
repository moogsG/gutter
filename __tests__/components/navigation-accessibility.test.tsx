import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JournalHeader } from "@/components/journal/JournalHeader";
import { EntryInput } from "@/components/journal/EntryInput";
import { TodayFocus } from "@/components/journal/TodayFocus";
import { EntryItem } from "@/components/journal/EntryItem";
import { MorningView } from "@/components/journal/MorningView";
import LoginPage from "@/app/login/page";

const updateEntry = vi.fn();
const migrateEntries = vi.fn();
const { toastSuccess, toastError } = vi.hoisted(() => ({ toastSuccess: vi.fn(), toastError: vi.fn() }));

vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: toastError } }));

vi.mock("next/navigation", () => ({
	usePathname: () => "/",
	useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
	useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/store/api/journalApi", () => ({
	journalApi: { util: { invalidateTags: vi.fn() } },
	useUpdateEntryMutation: () => [updateEntry],
	useAddEntryMutation: () => [vi.fn()],
	useMigrateEntriesMutation: () => [migrateEntries],
}));

vi.mock("react-redux", () => ({ useDispatch: () => vi.fn() }));
vi.mock("@/components/journal/VoiceButton", () => ({
	VoiceButton: () => <button type="button" aria-label="Record voice note" />,
}));

const entry = {
	id: "task-1",
	date: "2026-09-02",
	signifier: "task" as const,
	text: "Prepare review",
	status: "open" as const,
	sort_order: 0,
	tags: [],
	created_at: "2026-09-02T12:00:00.000Z",
	updated_at: "2026-09-02T12:00:00.000Z",
	children: [],
};

describe("navigation and control accessibility", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		updateEntry.mockReturnValue({ unwrap: async () => ({}) });
		migrateEntries.mockReturnValue({ unwrap: async () => ({ targetDate: "2026-09-03" }) });
		Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", { configurable: true, value: () => false });
		Object.defineProperty(HTMLElement.prototype, "setPointerCapture", { configurable: true, value: () => undefined });
		Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: () => undefined });
	});

	it("exposes a concise primary navigation", () => {
		render(<JournalHeader date="2026-09-02" onPrevDay={vi.fn()} onNextDay={vi.fn()} onToday={vi.fn()} />);

		const navigation = screen.getByRole("navigation", { name: "Primary" });
		expect(navigation).toBeInTheDocument();
		expect(navigation.querySelectorAll("a, button")).toHaveLength(4);
		expect(screen.getByRole("link", { name: "Today" })).toHaveAttribute("aria-current", "page");
		expect(screen.getByRole("link", { name: "Review" })).toHaveAttribute("href", "/kanban");
		expect(screen.getByRole("button", { name: "Journal" })).toHaveAttribute("aria-expanded", "false");
		expect(screen.getByRole("button", { name: "More" })).toHaveAttribute("aria-expanded", "false");
	});

	it("names date, menu, search, capture, and theme controls", () => {
		render(<JournalHeader date="2026-09-02" onPrevDay={vi.fn()} onNextDay={vi.fn()} onToday={vi.fn()} />);
		expect(screen.getByRole("button", { name: "Previous day" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Go to today" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Next day" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Open navigation" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Capture entry" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Search and commands" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Choose theme" })).toBeInTheDocument();
	});

	it("labels entry modes and signifiers with exposed selected state", async () => {
		const user = userEvent.setup();
		render(<EntryInput date="2026-09-02" onSubmit={vi.fn()} />);
		const quick = screen.getByRole("button", { name: "Quick entry" });
		const command = screen.getByRole("button", { name: "Natural language command" });
		expect(quick).toHaveAttribute("aria-pressed", "true");
		expect(command).toHaveAttribute("aria-pressed", "false");
		expect(screen.getByRole("button", { name: "Task" })).toHaveAttribute("aria-pressed", "true");
		expect(screen.getByRole("textbox", { name: "Journal entry" })).toHaveAttribute("placeholder", "Add a task or note…");
		await user.click(command);
		expect(command).toHaveAttribute("aria-pressed", "true");
		expect(screen.getByRole("textbox", { name: "Journal command" })).toHaveAttribute("placeholder", "Describe what you want to add or organize…");
	});

	it("keeps Today Focus actions visible and wrappable without hover", () => {
		render(<TodayFocus entries={[entry]} date="2026-09-02" />);
		const actions = screen.getByTestId("today-focus-actions-task-1");
		expect(actions).toHaveClass("flex-wrap");
		expect(actions).not.toHaveClass("opacity-0");
		expect(screen.getByRole("button", { name: "Start Prepare review" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Complete Prepare review" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Move Prepare review to a later day" })).toBeInTheDocument();
	});

	it("requires confirmation before striking out a journal entry", async () => {
		const onKill = vi.fn();
		const confirmMock = vi.fn().mockReturnValue(false);
		vi.stubGlobal("confirm", confirmMock);
		const user = userEvent.setup();
		render(<EntryItem entry={entry} onKill={onKill} />);

		await user.click(screen.getByRole("button", { name: "Open actions for Prepare review" }));
		await user.click(await screen.findByRole("menuitem", { name: "Strike Out" }));
		expect(confirmMock).toHaveBeenCalledWith('Strike out "Prepare review"? You can reopen it from this entry’s actions.');
		expect(onKill).not.toHaveBeenCalled();

		confirmMock.mockReturnValue(true);
		await user.click(screen.getByRole("button", { name: "Open actions for Prepare review" }));
		await user.click(await screen.findByRole("menuitem", { name: "Strike Out" }));
		expect(onKill).toHaveBeenCalledWith("task-1");
	});

	it("reports strike-out success and failure", async () => {
		vi.stubGlobal("confirm", vi.fn(() => true));
		const user = userEvent.setup();
		const onKill = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(undefined);
		render(<EntryItem entry={entry} onKill={onKill} />);

		await user.click(screen.getByRole("button", { name: "Open actions for Prepare review" }));
		await user.click(await screen.findByRole("menuitem", { name: "Strike Out" }));
		await waitFor(() => expect(toastError).toHaveBeenCalledWith("Could not strike out Prepare review"));

		await user.click(screen.getByRole("button", { name: "Open actions for Prepare review" }));
		await user.click(await screen.findByRole("menuitem", { name: "Strike Out" }));
		await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Prepare review was struck out"));
	});

	it("describes Today Focus setup without internal prompt or widget jargon", async () => {
		vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ results: [] }) }) as Response));
		const { container } = render(<MorningView date="2026-09-02" onOpenCapture={vi.fn()} />);

		expect(await screen.findByRole("heading", { name: "Set up Today Focus" })).toBeInTheDocument();
		expect(screen.getByText("Choose the information you want ready when you start your day.")).toBeInTheDocument();
		expect(screen.queryByText(/prompts|widgets|source/i)).not.toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Configure Today Focus" })).toHaveAttribute("href", "/settings/morning-view");
		expect(container.querySelector("a button, button a")).toBeNull();
		expect(screen.getByTestId("today-focus-empty-actions")).toHaveClass("flex-wrap");
	});

	it("labels login controls and announces authentication errors", async () => {
		vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false }) as Response));
		const user = userEvent.setup();
		render(<LoginPage />);
		await user.type(screen.getByLabelText("Password"), "wrong");
		await user.click(screen.getByRole("button", { name: "Sign in" }));
		expect(await screen.findByRole("alert")).toHaveTextContent("Wrong password");
	});
});
