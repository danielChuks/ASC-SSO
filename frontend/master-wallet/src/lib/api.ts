const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || res.statusText);
  }
  return res.json() as Promise<T>;
}

export async function registerCommitment(commitment: string) {
  return apiFetch(`${API_URL}/api/v1/registry/register`, {
    method: "POST",
    body: JSON.stringify({ commitment }),
  });
}

/** Get anonymity group for ZK proof */
export async function getAnonymityGroup() {
  const res = await fetch(`${API_URL}/api/v1/registry/group`);
  if (!res.ok) throw new Error("Failed to get group");
  return res.json();
}

/** U2SSO registration (ZK proof) */
export async function registerWithSp(data: {
  sp_id: string;
  pseudonym: string;
  nullifier_hash: string;
  proof: string;
  merkle_tree_root: string;
}) {
  return apiFetch(`${API_URL}/api/v1/verify/register`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** Get challenge for Gauth authentication */
export async function getAuthChallenge(
  spId: string,
  pseudonym: string
): Promise<{ challenge: string; sp_id: string; expires_in: number }> {
  return apiFetch<{ challenge: string; sp_id: string; expires_in: number }>(
    `${API_URL}/api/v1/verify/auth/challenge?sp_id=${encodeURIComponent(spId)}&pseudonym=${encodeURIComponent(pseudonym)}`
  );
}

/** U2SSO authentication (Gauth) */
export async function authenticate(data: {
  sp_id: string;
  pseudonym: string;
  challenge: string;
  signature: string;
}) {
  return apiFetch(`${API_URL}/api/v1/verify/auth`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}
