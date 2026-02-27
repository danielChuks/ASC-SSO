import { hkdfExtractExpand } from "./hkdf";

const NULLIFIER_SALT = new TextEncoder().encode("shieldlogin-nullifier-v1");

/**
 * Derive nullifier for (msk, sp_id). One per SP for Sybil resistance.
 * Matches backend derive_nullifier.
 */
export async function deriveNullifier(msk: string, spId: string): Promise<string> {
  const keyMaterial = new TextEncoder().encode(msk);
  const info = new TextEncoder().encode(spId);
  const out = await hkdfExtractExpand(keyMaterial.buffer, NULLIFIER_SALT, info);
  return Array.from(out)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
