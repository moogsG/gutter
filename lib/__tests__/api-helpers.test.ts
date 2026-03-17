/**
 * Tests for lib/api-helpers.ts
 */

import { describe, expect, it, vi } from "vitest";
import { errorResponse, successResponse, withErrorHandling } from "@/lib/api-helpers";
import { NextResponse } from "next/server";

describe("errorResponse()", () => {
	it("returns JSON error response with default 500 status", async () => {
		const response = errorResponse("Something went wrong");

		expect(response).toBeInstanceOf(NextResponse);
		expect(response.status).toBe(500);

		const body = await response.json();
		expect(body.error).toBe("Something went wrong");
	});

	it("accepts custom status code", async () => {
		const response = errorResponse("Not found", 404);

		expect(response.status).toBe(404);

		const body = await response.json();
		expect(body.error).toBe("Not found");
	});

	it("includes details when provided", async () => {
		const details = { field: "email", reason: "invalid format" };
		const response = errorResponse("Validation failed", 400, details);

		expect(response.status).toBe(400);

		const body = await response.json();
		expect(body.error).toBe("Validation failed");
		expect(body.details).toEqual(details);
	});

	it("omits details when not provided", async () => {
		const response = errorResponse("Error message");

		const body = await response.json();
		expect(body).toHaveProperty("error");
		expect(body).not.toHaveProperty("details");
	});

	it("handles various error status codes", async () => {
		const statuses = [400, 401, 403, 404, 429, 500, 503];

		for (const status of statuses) {
			const response = errorResponse("Error", status);
			expect(response.status).toBe(status);
		}
	});

	it("includes details even when falsy but defined", async () => {
		const response = errorResponse("Error", 400, 0);

		const body = await response.json();
		expect(body.details).toBe(0);
	});
});

describe("successResponse()", () => {
	it("returns JSON success response with default 200 status", async () => {
		const data = { message: "Success", id: "123" };
		const response = successResponse(data);

		expect(response).toBeInstanceOf(NextResponse);
		expect(response.status).toBe(200);

		const body = await response.json();
		expect(body).toEqual(data);
	});

	it("accepts custom status code", async () => {
		const data = { id: "new-123" };
		const response = successResponse(data, 201);

		expect(response.status).toBe(201);

		const body = await response.json();
		expect(body).toEqual(data);
	});

	it("handles various data types", async () => {
		// Array
		const arrayResponse = successResponse([1, 2, 3]);
		const arrayBody = await arrayResponse.json();
		expect(arrayBody).toEqual([1, 2, 3]);

		// String
		const stringResponse = successResponse("success");
		const stringBody = await stringResponse.json();
		expect(stringBody).toBe("success");

		// Number
		const numberResponse = successResponse(42);
		const numberBody = await numberResponse.json();
		expect(numberBody).toBe(42);

		// Boolean
		const boolResponse = successResponse(true);
		const boolBody = await boolResponse.json();
		expect(boolBody).toBe(true);
	});

	it("handles nested objects", async () => {
		const data = {
			user: {
				id: "123",
				profile: {
					name: "Test User",
					settings: {
						theme: "dark",
					},
				},
			},
		};

		const response = successResponse(data);
		const body = await response.json();
		expect(body).toEqual(data);
	});

	it("handles empty objects", async () => {
		const response = successResponse({});
		const body = await response.json();
		expect(body).toEqual({});
	});

	it("handles null", async () => {
		const response = successResponse(null);
		const body = await response.json();
		expect(body).toBeNull();
	});
});

describe("withErrorHandling()", () => {
	it("returns successful response when handler succeeds", async () => {
		const handler = async () => successResponse({ message: "Success" });

		const response = await withErrorHandling(handler);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body).toEqual({ message: "Success" });
	});

	it("catches and returns error response when handler throws Error", async () => {
		const handler = async () => {
			throw new Error("Test error");
		};

		const response = await withErrorHandling(handler);

		expect(response.status).toBe(500);
		const body = await response.json();
		expect(body.error).toBe("Test error");
	});

	it("handles non-Error throws", async () => {
		const handler = async () => {
			throw "String error";
		};

		const response = await withErrorHandling(handler);

		expect(response.status).toBe(500);
		const body = await response.json();
		expect(body.error).toBe("Internal server error");
	});

	it("handles async handler that rejects", async () => {
		const handler = async () => {
			await Promise.reject(new Error("Async rejection"));
			return successResponse({});
		};

		const response = await withErrorHandling(handler);

		expect(response.status).toBe(500);
		const body = await response.json();
		expect(body.error).toBe("Async rejection");
	});

	it("preserves response status from successful handler", async () => {
		const handler = async () => successResponse({ id: "123" }, 201);

		const response = await withErrorHandling(handler);

		expect(response.status).toBe(201);
	});

	it("logs errors to console", async () => {
		const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		const error = new Error("Test error");
		const handler = async () => {
			throw error;
		};

		await withErrorHandling(handler);

		expect(consoleErrorSpy).toHaveBeenCalledWith("[API Error]", error);
		consoleErrorSpy.mockRestore();
	});

	it("handles handler that throws during async operation", async () => {
		const handler = async () => {
			// Simulate async work
			await new Promise((resolve) => setTimeout(resolve, 10));
			throw new Error("Delayed error");
		};

		const response = await withErrorHandling(handler);

		expect(response.status).toBe(500);
		const body = await response.json();
		expect(body.error).toBe("Delayed error");
	});

	it("handles TypeError", async () => {
		const handler = async () => {
			// @ts-expect-error Testing runtime error
			null.someMethod();
			return successResponse({});
		};

		const response = await withErrorHandling(handler);

		expect(response.status).toBe(500);
		const body = await response.json();
		// Different runtimes have different error messages for this
		expect(body.error).toBeTruthy();
		expect(typeof body.error).toBe("string");
	});
});
