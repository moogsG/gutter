import { NextResponse } from "next/server";
import { describe, expect, it } from "vitest";
import {
	formatError,
	handleApiError,
	handleAuthError,
	handleNotFoundError,
	handleValidationError,
} from "@/lib/api-error-handler";

describe("api-error-handler", () => {
	describe("formatError", () => {
		it("should format Error instances", () => {
			const error = new Error("Something went wrong");
			expect(formatError(error)).toBe("Something went wrong");
		});

		it("should format string errors", () => {
			expect(formatError("Simple error")).toBe("Simple error");
		});

		it("should format unknown error types", () => {
			expect(formatError(42)).toBe("42");
			expect(formatError(null)).toBe("null");
			expect(formatError(undefined)).toBe("undefined");
		});
	});

	describe("handleApiError", () => {
		it("should return 500 by default", async () => {
			const response = handleApiError("test operation", new Error("Test error"));
			expect(response.status).toBe(500);

			const json = await response.json();
			expect(json).toEqual({ error: "Failed to test operation" });
		});

		it("should support custom status codes", async () => {
			const response = handleApiError(
				"test operation",
				new Error("Test error"),
				404,
			);
			expect(response.status).toBe(404);
		});

		it("should include error details when requested", async () => {
			const response = handleApiError(
				"test operation",
				new Error("Specific error message"),
				500,
				true,
			);

			const json = await response.json();
			expect(json).toEqual({
				error: "Failed to test operation",
				details: "Specific error message",
			});
		});

		it("should exclude error details by default", async () => {
			const response = handleApiError(
				"test operation",
				new Error("Secret error"),
			);

			const json = await response.json();
			expect(json).toEqual({ error: "Failed to test operation" });
			expect(json).not.toHaveProperty("details");
		});
	});

	describe("handleValidationError", () => {
		it("should return 400 status", async () => {
			const response = handleValidationError("Invalid input");
			expect(response.status).toBe(400);

			const json = await response.json();
			expect(json).toEqual({ error: "Invalid input" });
		});

		it("should include details when provided", async () => {
			const response = handleValidationError(
				"Invalid input",
				"Field 'email' is required",
			);

			const json = await response.json();
			expect(json).toEqual({
				error: "Invalid input",
				details: "Field 'email' is required",
			});
		});
	});

	describe("handleAuthError", () => {
		it("should return 401 status with default message", async () => {
			const response = handleAuthError();
			expect(response.status).toBe(401);

			const json = await response.json();
			expect(json).toEqual({ error: "Unauthorized" });
		});

		it("should support custom auth error messages", async () => {
			const response = handleAuthError("Invalid token");

			const json = await response.json();
			expect(json).toEqual({ error: "Invalid token" });
		});
	});

	describe("handleNotFoundError", () => {
		it("should return 404 status", async () => {
			const response = handleNotFoundError("User");
			expect(response.status).toBe(404);

			const json = await response.json();
			expect(json).toEqual({ error: "User not found" });
		});

		it("should format resource name in error message", async () => {
			const response = handleNotFoundError("Journal entry");

			const json = await response.json();
			expect(json).toEqual({ error: "Journal entry not found" });
		});
	});
});
