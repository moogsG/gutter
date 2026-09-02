import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const updateFutureEntry = vi.fn();
const markFutureEntryMigrated = vi.fn();
const deleteFutureEntry = vi.fn();
const refetchFutureLog = vi.fn();
const entry = {
	id: "fl-edit",
	target_month: "2026-10",
	signifier: "task" as const,
	text: "Renew passport",
	migrated: false,
	created_at: "2026-09-02T12:00:00.000Z",
};
let futureLogQuery: {
	data?: typeof entry[];
	isError: boolean;
	isFetching: boolean;
	refetch: typeof refetchFutureLog;
};

vi.mock("@/components/journal/JournalHeader", () => ({ JournalHeader: () => <header /> }));
vi.mock("@/components/journal/SignifierIcon", () => ({ SignifierIcon: () => <span /> }));
vi.mock("@/store/api/journalApi", () => ({
	useGetFutureLogQuery: () => futureLogQuery,
	useCreateFutureLogEntryMutation: () => [vi.fn(), { isLoading: false }],
	useUpdateFutureLogEntryMutation: () => [updateFutureEntry, { isLoading: false }],
	useMarkFutureLogEntryMigratedMutation: () => [markFutureEntryMigrated, { isLoading: false }],
	useDeleteFutureLogEntryMutation: () => [deleteFutureEntry, { isLoading: false }],
}));

describe("Future Log lifecycle", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		futureLogQuery = {
			data: [entry],
			isError: false,
			isFetching: false,
			refetch: refetchFutureLog,
		};
		for (const mutation of [updateFutureEntry, markFutureEntryMigrated, deleteFutureEntry]) {
			mutation.mockReturnValue({ unwrap: async () => ({}) });
		}
	});

	it("renders an unavailable state and retry action when the read fails", async () => {
		futureLogQuery = {
			data: undefined,
			isError: true,
			isFetching: false,
			refetch: refetchFutureLog,
		};
		const user = userEvent.setup();
		const { default: FutureLogPage } = await import("@/app/future/page");
		render(<FutureLogPage />);

		expect(screen.getByRole("alert")).toHaveTextContent(/future log is unavailable/i);
		expect(screen.queryByText(/No future entries yet/i)).not.toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: /retry loading future log/i }));
		expect(refetchFutureLog).toHaveBeenCalledTimes(1);
	});

	it("edits text, type, and month through the client mutation", async () => {
		const user = userEvent.setup();
		const { default: FutureLogPage } = await import("@/app/future/page");
		render(<FutureLogPage />);

		await user.click(screen.getByRole("button", { name: "Edit Renew passport" }));
		const text = screen.getByDisplayValue("Renew passport");
		await user.clear(text);
		await user.type(text, "Renew passports");
		await user.clear(screen.getByDisplayValue("2026-10"));
		await user.type(screen.getByLabelText("Edit target month"), "2026-11");
		await user.click(screen.getAllByRole("button", { name: "appointment" }).at(-1)!);
		await user.click(screen.getByRole("button", { name: "Save future entry" }));

		await waitFor(() =>
			expect(updateFutureEntry).toHaveBeenCalledWith({
				id: "fl-edit",
				text: "Renew passports",
				signifier: "appointment",
				target_month: "2026-11",
			}),
		);
	});

	it("marks an entry migrated through its explicit action", async () => {
		const user = userEvent.setup();
		const { default: FutureLogPage } = await import("@/app/future/page");
		render(<FutureLogPage />);

		await user.click(screen.getByRole("button", { name: "Mark Renew passport migrated" }));
		await waitFor(() => expect(markFutureEntryMigrated).toHaveBeenCalledWith("fl-edit"));
	});

	it("deletes an entry through its explicit action", async () => {
		const user = userEvent.setup();
		const { default: FutureLogPage } = await import("@/app/future/page");
		render(<FutureLogPage />);

		await user.click(screen.getByRole("button", { name: "Delete Renew passport" }));
		await waitFor(() => expect(deleteFutureEntry).toHaveBeenCalledWith("fl-edit"));
	});

	it("keeps the edit draft open and offers retry when updating fails", async () => {
		updateFutureEntry.mockReturnValue({ unwrap: async () => { throw new Error("offline"); } });
		const user = userEvent.setup();
		const { default: FutureLogPage } = await import("@/app/future/page");
		render(<FutureLogPage />);

		await user.click(screen.getByRole("button", { name: "Edit Renew passport" }));
		const text = screen.getByLabelText("Edit future entry text");
		await user.clear(text);
		await user.type(text, "Renew passports soon");
		await user.click(screen.getByRole("button", { name: "Save future entry" }));

		expect(await screen.findByRole("alert")).toHaveTextContent(/could not update.*try again/i);
		expect(text).toHaveValue("Renew passports soon");
		expect(screen.getByRole("button", { name: "Save future entry" })).toBeInTheDocument();
	});

	it("preserves the entry and offers retry when marking migrated fails", async () => {
		markFutureEntryMigrated.mockReturnValue({ unwrap: async () => { throw new Error("offline"); } });
		const user = userEvent.setup();
		const { default: FutureLogPage } = await import("@/app/future/page");
		render(<FutureLogPage />);

		await user.click(screen.getByRole("button", { name: "Mark Renew passport migrated" }));

		expect(await screen.findByRole("alert")).toHaveTextContent(/could not mark.*try again/i);
		expect(screen.getByText("Renew passport")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Mark Renew passport migrated" })).toBeInTheDocument();
	});

	it("preserves the entry and offers retry when deleting fails", async () => {
		deleteFutureEntry.mockReturnValue({ unwrap: async () => { throw new Error("offline"); } });
		const user = userEvent.setup();
		const { default: FutureLogPage } = await import("@/app/future/page");
		render(<FutureLogPage />);

		await user.click(screen.getByRole("button", { name: "Delete Renew passport" }));

		expect(await screen.findByRole("alert")).toHaveTextContent(/could not delete.*try again/i);
		expect(screen.getByText("Renew passport")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Delete Renew passport" })).toBeInTheDocument();
	});
});
