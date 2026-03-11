import { deriveChildSecret } from "./childCredential";
import { bytesToHex } from "./utils";

import { getPublicKeyAsync, signAsync } from "@noble/ed25519";

/**
 * Gauth: Ed25519-based authentication (per U2SSO paper).
 * Uses @noble/ed25519 for signing and verification.
 */

/**
 * Derive pseudonym (ϕ) and child secret for SP from r.
 * Use pseudonym for API, cskl for signWithSeed. Avoids duplicate HKDF.
 */
export async function getPseudonymWithSeed(r: string, spId: string): Promise<{
  pseudonym: string;
  cskl: Uint8Array;
}> {
  const cskl = await deriveChildSecret(r, spId);
  const pk = await getPublicKeyFromSeed(cskl);
  return { pseudonym: bytesToHex(pk), cskl };
}

/**
 * Get public key (pseudonym ϕ) from 32-byte seed.
 * In Ed25519, the seed is the secret key.
 */
export async function getPublicKeyFromSeed(seed: Uint8Array): Promise<Uint8Array> {
  return getPublicKeyAsync(seed);
}

/**
 * Sign message with seed (Ed25519).
 * Returns signature as hex string.
 */
export async function signWithSeed(seed: Uint8Array, messageHex: string): Promise<string> {
  const message = hexToBytes(messageHex);
  const signature = await signAsync(message, seed);
  return bytesToHex(signature);
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}
