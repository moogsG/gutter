"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginForm() {
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const router = useRouter();
	const searchParams = useSearchParams();
	const from = searchParams.get("from") || "/";

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setLoading(true);

		try {
			const res = await fetch("/api/auth", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ password }),
			});

			if (res.ok) {
				router.push(from);
				router.refresh();
			} else {
				setError("Wrong password.");
				setPassword("");
			}
		} catch {
			setError("Something went wrong.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-background">
			<div className="w-full max-w-sm mx-auto px-6">
				<div className="text-center mb-8">
					<img
						src="/logo.png"
						alt="Gutter"
						className="h-12 w-auto mx-auto mb-4"
					/>
					<p className="text-sm text-muted-foreground mt-1">
						enter password to continue
					</p>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					<input
						type="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						placeholder="password"
						autoComplete="current-password"
						className="w-full bg-muted/50 border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none"
					/>

					{error && (
						<p className="text-sm text-destructive text-center">{error}</p>
					)}

					<button
						type="submit"
						disabled={loading || !password}
						className="w-full bg-primary text-primary-foreground rounded-lg px-4 py-3 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
					>
						{loading ? "..." : "enter"}
					</button>
				</form>
			</div>
		</div>
	);
}

export default function LoginPage() {
	return (
		<Suspense
			fallback={
				<div className="min-h-screen flex items-center justify-center bg-background">
					<p className="text-muted-foreground">Loading...</p>
				</div>
			}
		>
			<LoginForm />
		</Suspense>
	);
}
