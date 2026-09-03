import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createCollection = vi.fn();
const createFutureEntry = vi.fn();
const migrateEntries = vi.fn();
const updateEntry = vi.fn();
let unresolvedEntries: any[] = [];

vi.mock("@/components/journal/JournalHeader", () => ({ JournalHeader: () => <header /> }));
vi.mock("@/components/journal/SignifierIcon", () => ({ SignifierIcon: () => <span /> }));
vi.mock("@/store/api/journalApi", () => ({
	useGetCollectionsQuery: () => ({ data: [] }),
	useCreateCollectionMutation: () => [createCollection, { isLoading: false }],
	useGetFutureLogQuery: () => ({ data: [] }),
	useCreateFutureLogEntryMutation: () => [createFutureEntry, { isLoading: false }],
	useUpdateFutureLogEntryMutation: () => [vi.fn(), { isLoading: false }],
	useMarkFutureLogEntryMigratedMutation: () => [vi.fn(), { isLoading: false }],
	useDeleteFutureLogEntryMutation: () => [vi.fn(), { isLoading: false }],
	useGetUnresolvedQuery: () => ({ data: unresolvedEntries }),
	useMigrateEntriesMutation: () => [migrateEntries, { isLoading: false }],
	useUpdateEntryMutation: () => [updateEntry, { isLoading: false }],
}));

describe("mutation failure recovery", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		unresolvedEntries = [];
		Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", { configurable: true, value: () => false });
		Object.defineProperty(HTMLElement.prototype, "setPointerCapture", { configurable: true, value: () => undefined });
		Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: () => undefined });
		vi.stubGlobal("confirm", vi.fn());
	});

	it("keeps the collection dialog and title draft open when creation fails", async () => {
		createCollection.mockReturnValue({ unwrap: async () => { throw new Error("offline"); } });
		const user = userEvent.setup();
		const { default: CollectionsPage } = await import("@/app/collections/page");
		render(<CollectionsPage />);

		await user.click(screen.getByRole("button", { name: /New Collection/ }));
		const title = screen.getByPlaceholderText("Collection title");
		await user.type(title, "Launch notes");
		await user.click(screen.getByRole("button", { name: "Create" }));

		await waitFor(() => expect(createCollection).toHaveBeenCalled());
		expect(screen.getByRole("dialog")).toBeInTheDocument();
		expect(title).toHaveValue("Launch notes");
		expect(screen.getByRole("alert")).toHaveTextContent(/could not create/i);
		expect(screen.getByRole("button", { name: /Try again/i })).toBeInTheDocument();
	});

	it("keeps the future entry draft when creation fails", async () => {
		createFutureEntry.mockReturnValue({ unwrap: async () => { throw new Error("offline"); } });
		const user = userEvent.setup();
		const { default: FutureLogPage } = await import("@/app/future/page");
		render(<FutureLogPage />);

		await user.type(screen.getByPlaceholderText("Target month"), "2026-10");
		const text = screen.getByPlaceholderText("What do you want to remember?");
		await user.type(text, "Renew passport");
		await user.click(screen.getByRole("button", { name: "Add Entry" }));

		await waitFor(() => expect(createFutureEntry).toHaveBeenCalled());
		expect(text).toHaveValue("Renew passport");
		expect(screen.getByRole("alert")).toHaveTextContent(/could not add/i);
		expect(screen.getByRole("button", { name: /Try again/i })).toBeInTheDocument();
	});

	it("keeps migration selections and exposes retry when migration fails", async () => {
		unresolvedEntries = [{
			id: "entry-1",
			date: "2026-08-31",
			signifier: "task",
			text: "Carry me forward",
			status: "open",
		}];
		migrateEntries.mockReturnValue({ unwrap: async () => { throw new Error("offline"); } });
		const user = userEvent.setup();
		const { default: MigratePage } = await import("@/app/migrate/page");
		render(<MigratePage />);

		await user.click(screen.getByRole("checkbox"));
		await user.click(screen.getByRole("button", { name: "Migrate" }));

		await waitFor(() => expect(migrateEntries).toHaveBeenCalled());
		expect(screen.getByRole("checkbox")).toBeChecked();
		expect(screen.getByRole("alert")).toHaveTextContent(/could not migrate/i);
		expect(screen.getByRole("button", { name: /Try migration again/i })).toBeInTheDocument();
	});

	it("awaits a migration kill and exposes retry when it fails", async () => {
		unresolvedEntries = [{
			id: "entry-1",
			date: "2026-08-31",
			signifier: "task",
			text: "Drop this task",
			status: "open",
		}];
		updateEntry.mockReturnValue({ unwrap: async () => { throw new Error("offline"); } });
		vi.mocked(confirm).mockReturnValue(true);
		const user = userEvent.setup();
		const { default: MigratePage } = await import("@/app/migrate/page");
		render(<MigratePage />);

		await user.click(screen.getByRole("button", { name: "Kill Drop this task" }));

		await waitFor(() => expect(updateEntry).toHaveBeenCalled());
		expect(screen.getByRole("alert")).toHaveTextContent(/could not kill/i);
		expect(screen.getByRole("button", { name: /Try killing Drop this task again/i })).toBeInTheDocument();
	});

	it("requires confirmation before killing a migration entry and announces success", async () => {
		unresolvedEntries = [{
			id: "entry-1",
			date: "2026-08-31",
			signifier: "task",
			text: "Drop this task",
			status: "open",
		}];
		updateEntry.mockReturnValue({ unwrap: async () => ({}) });
		const confirmMock = vi.mocked(confirm).mockReturnValue(false);
		const user = userEvent.setup();
		const { default: MigratePage } = await import("@/app/migrate/page");
		render(<MigratePage />);

		expect(screen.getByRole("checkbox", { name: "Select Drop this task for migration" })).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Kill Drop this task" }));
		expect(confirmMock).toHaveBeenCalledWith('Strike out "Drop this task"? You can reopen it later from its journal day.');
		expect(updateEntry).not.toHaveBeenCalled();

		confirmMock.mockReturnValue(true);
		await user.click(screen.getByRole("button", { name: "Kill Drop this task" }));
		await waitFor(() => expect(updateEntry).toHaveBeenCalledWith({ id: "entry-1", status: "killed" }));
		expect(screen.getByRole("status")).toHaveTextContent("Drop this task was struck out");
	});
});
