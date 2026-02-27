const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function registerCommitment(commitment: string) {
  const res = await fetch(`${API_URL}/api/v1/registry/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commitment }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || res.statusText);
  }
  return res.json();
}

export async function getNonce(spId: string) {
  const res = await fetch(`${API_URL}/api/v1/verify/nonce?sp_id=${encodeURIComponent(spId)}`);
  if (!res.ok) throw new Error("Failed to get nonce");
  return res.json();
}

export async function verifyCredential(data: {
  sp_id: string;
  nonce: string;
  proof: string;
  nullifier: string;
  commitment: string;
}) {
  const res = await fetch(`${API_URL}/api/v1/verify/credential`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || res.statusText);
  }
  return res.json();
}
