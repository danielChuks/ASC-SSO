import { bytesToHex } from "./utils";

/**
 * Generate a random nonce for challenge.
 * Matches backend generate_nonce (64 hex chars).
 */
export function generateNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}
