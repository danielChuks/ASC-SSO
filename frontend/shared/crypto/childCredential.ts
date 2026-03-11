import { hkdfExtractExpand } from "./hkdf";

const CHILD_SALT = new TextEncoder().encode("shieldlogin-child-v1");

/**
 * Derive child secret key for SP (Gauth).
 * cskl = HKDF(r, sp_id) — matches paper: cskl := HKDF(r, vl)
 */
export async function deriveChildSecret(r: string, spId: string): Promise<Uint8Array> {
  const keyMaterial = new TextEncoder().encode(r);
  const info = new TextEncoder().encode(spId);
  return hkdfExtractExpand(keyMaterial.buffer as ArrayBuffer, CHILD_SALT, info, 32);
}
