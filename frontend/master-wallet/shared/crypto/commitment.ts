import { bytesToHex } from "./utils";

/**
 * Compute commitment (public identity) from master secret.
 * C = SHA256(msk) — matches backend commitment_from_secret.
 */
export async function commitmentFromSecret(msk: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(msk);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(hash));
}
