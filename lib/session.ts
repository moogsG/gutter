const encoder = new TextEncoder();

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(value: string): Uint8Array | null {
	if (!/^[a-f0-9]{64}$/.test(value)) return null;
	return new Uint8Array(value.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? []);
}

async function getSigningKey(secret: string) {
	return crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign", "verify"],
	);
}

function getSecret(): string | null {
	const secret = process.env.AUTH_SECRET?.trim();
	return secret || null;
}

export async function createSessionToken(maxAgeSeconds: number): Promise<string> {
	const secret = getSecret();
	if (!secret) throw new Error("AUTH_SECRET is required when authentication is enabled");
	const expiresAt = Date.now() + maxAgeSeconds * 1000;
	const nonce = new Uint8Array(24);
	crypto.getRandomValues(nonce);
	const payload = `${expiresAt}.${bytesToHex(nonce)}`;
	const signature = await crypto.subtle.sign(
		"HMAC",
		await getSigningKey(secret),
		encoder.encode(payload),
	);
	return `${payload}.${bytesToHex(new Uint8Array(signature))}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
	const secret = getSecret();
	if (!secret || !token) return false;
	const [expiresValue, nonce, signatureValue, ...extra] = token.split(".");
	if (extra.length > 0 || !/^\d+$/.test(expiresValue) || !/^[a-f0-9]{48}$/.test(nonce)) {
		return false;
	}
	const expiresAt = Number(expiresValue);
	if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) return false;
	const signature = hexToBytes(signatureValue);
	if (!signature) return false;
	return crypto.subtle.verify(
		"HMAC",
		await getSigningKey(secret),
		new Uint8Array(signature).buffer,
		encoder.encode(`${expiresValue}.${nonce}`),
	);
}
