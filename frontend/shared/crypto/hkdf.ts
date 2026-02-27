/**
 * HKDF-like key derivation (matches backend Python implementation).
 * Uses HMAC-SHA256 for extract and expand.
 */
async function hmacSha256(key: ArrayBuffer, data: ArrayBuffer): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return crypto.subtle.sign("HMAC", cryptoKey, data);
}

function concat(...buffers: ArrayBufferLike[]): Uint8Array {
  const total = buffers.reduce((acc, b) => acc + b.byteLength, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const b of buffers) {
    result.set(new Uint8Array(b), offset);
    offset += b.byteLength;
  }
  return result;
}

export async function hkdfExtractExpand(
  keyMaterial: ArrayBuffer,
  salt: Uint8Array,
  info: Uint8Array,
  length: number = 32
): Promise<Uint8Array> {
  const prk = await hmacSha256(salt.buffer as ArrayBuffer, keyMaterial);
  let okm = new Uint8Array(0);
  let prev = new Uint8Array(0);
  const iterations = Math.ceil(length / 32);
  for (let i = 0; i < iterations; i++) {
    const block = concat(prev.buffer, info.buffer, new Uint8Array([i + 1]).buffer);
    prev = new Uint8Array(await hmacSha256(prk, block.buffer as ArrayBuffer));
    const newOkm = new Uint8Array(okm.length + prev.length);
    newOkm.set(okm);
    newOkm.set(prev, okm.length);
    okm = newOkm;
  }
  return okm.slice(0, length);
}
