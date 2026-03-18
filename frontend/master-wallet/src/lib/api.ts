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
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || "Failed to get group");
  }
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
  console.log("data is ", data);
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

/** DAO: List proposals */
export async function getDaoProposals(): Promise<
  Array<{
    id: number;
    description: string;
    start_time: number;
    end_time: number;
    finalized: boolean;
    yes_votes: number;
    no_votes: number;
    abstain_votes: number;
    voting_open: boolean;
  }>
> {
  return apiFetch(`${API_URL}/api/v1/dao/proposals`);
}

/** DAO: Cast vote with ZK proof */
export async function castDaoVote(data: {
  proposal_id: number;
  vote_choice: number;
  proof: string;
  nullifier_hash: string;
  merkle_tree_root: string;
}) {
  return apiFetch<{ success: boolean; message: string; tx_hash?: string }>(
    `${API_URL}/api/v1/dao/vote`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
}
