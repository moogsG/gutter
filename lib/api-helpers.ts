/**
 * Shared API route helpers for consistent error handling and responses
 */

import { NextResponse } from "next/server";

export interface ApiError {
	error: string;
	details?: unknown;
}

/**
 * Standard error response format
 */
export function errorResponse(
	message: string,
	status = 500,
	details?: unknown,
): NextResponse<ApiError> {
	const response: ApiError = { error: message };
	if (details !== undefined) {
		response.details = details;
	}
	return NextResponse.json(response, { status });
}

/**
 * Standard success response format
 */
export function successResponse<T>(data: T, status = 200): NextResponse<T> {
	return NextResponse.json(data, { status });
}

/**
 * Wrapper for API route handlers to ensure consistent error handling
 */
export function withErrorHandling<T = unknown>(
	handler: () => Promise<NextResponse<T>>,
): Promise<NextResponse<T | ApiError>> {
	return handler().catch((error: unknown) => {
		console.error("[API Error]", error);
		const message =
			error instanceof Error ? error.message : "Internal server error";
		return errorResponse(message, 500);
	});
}
