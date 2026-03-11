import { hkdfExtractExpand } from "./hkdf";
import { bytesToHex } from "./utils";

const PROOF_SALT = new TextEncoder().encode("shieldlogin-proof-v1");

/**
 * Create proof (HMAC) over (nonce, sp_id) using derived child key.
 * Matches backend create_proof.
 */
export async function createProof(msk: string, spId: string, nonce: string): Promise<string> {
  const keyMaterial = new TextEncoder().encode(msk);
  const info = new TextEncoder().encode(spId);
  const childKey = await hkdfExtractExpand(keyMaterial.buffer, PROOF_SALT, info);

  const keyBuffer = new ArrayBuffer(childKey.length);
  new Uint8Array(keyBuffer).set(childKey);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const message = new TextEncoder().encode(`${nonce}:${spId}`);
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, message);

  return bytesToHex(new Uint8Array(signature));
}
