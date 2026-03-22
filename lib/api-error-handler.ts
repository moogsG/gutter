/**
 * Centralized API error handling utilities
 */

import { NextResponse } from "next/server";

/**
 * Error response structure
 */
export interface ErrorResponse {
	error: string;
	details?: string;
}

/**
 * Format an error for consistent API responses
 */
export function formatError(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	return String(error);
}

/**
 * Create a standardized error response
 *
 * @param operation - Description of the failed operation (e.g., "fetch entries", "create entry")
 * @param error - The error that occurred
 * @param status - HTTP status code (default: 500)
 * @param includeDetails - Whether to include error details in response (default: false for security)
 * @returns NextResponse with error JSON
 *
 * @example
 * ```ts
 * try {
 *   const entries = await db.getEntries();
 *   return NextResponse.json(entries);
 * } catch (error) {
 *   return handleApiError("fetch entries", error);
 * }
 * ```
 */
export function handleApiError(
	operation: string,
	error: unknown,
	status = 500,
	includeDetails = false,
): NextResponse<ErrorResponse> {
	// Log the full error for debugging
	console.error(`Error ${operation}:`, error);

	const errorResponse: ErrorResponse = {
		error: `Failed to ${operation}`,
	};

	// Only include details if explicitly requested (dev mode, debugging)
	if (includeDetails) {
		errorResponse.details = formatError(error);
	}

	return NextResponse.json(errorResponse, { status });
}

/**
 * Handle validation errors with a 400 status
 */
export function handleValidationError(
	message: string,
	details?: string,
): NextResponse<ErrorResponse> {
	console.error("Validation error:", message, details);

	return NextResponse.json(
		{
			error: message,
			...(details && { details }),
		},
		{ status: 400 },
	);
}

/**
 * Handle authentication errors with a 401 status
 */
export function handleAuthError(
	message = "Unauthorized",
): NextResponse<ErrorResponse> {
	return NextResponse.json({ error: message }, { status: 401 });
}

/**
 * Handle not found errors with a 404 status
 */
export function handleNotFoundError(
	resource: string,
): NextResponse<ErrorResponse> {
	return NextResponse.json(
		{ error: `${resource} not found` },
		{ status: 404 },
	);
}
