import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const updateFutureEntry = vi.fn();
const markFutureEntryMigrated = vi.fn();
const deleteFutureEntry = vi.fn();

vi.mock("@/components/journal/JournalHeader", () => ({ JournalHeader: () => <header /> }));
vi.mock("@/components/journal/SignifierIcon", () => ({ SignifierIcon: () => <span /> }));
vi.mock("@/store/api/journalApi", () => ({
	useGetFutureLogQuery: () => ({
		data: [
			{
				id: "fl-edit",
				target_month: "2026-10",
				signifier: "task",
				text: "Renew passport",
				migrated: false,
				created_at: "2026-09-02T12:00:00.000Z",
			},
		],
	}),
	useCreateFutureLogEntryMutation: () => [vi.fn(), { isLoading: false }],
	useUpdateFutureLogEntryMutation: () => [updateFutureEntry, { isLoading: false }],
	useMarkFutureLogEntryMigratedMutation: () => [markFutureEntryMigrated, { isLoading: false }],
	useDeleteFutureLogEntryMutation: () => [deleteFutureEntry, { isLoading: false }],
}));

describe("Future Log lifecycle", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		for (const mutation of [updateFutureEntry, markFutureEntryMigrated, deleteFutureEntry]) {
			mutation.mockReturnValue({ unwrap: async () => ({}) });
		}
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
});
