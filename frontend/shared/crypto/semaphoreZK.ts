/**
 * Semaphore ZK proof for ASC (Anonymous Self-Credentials).
 * Replaces HMAC proof with zero-knowledge proof of membership in anonymity set.
 */
import type { Identity } from "@semaphore-protocol/identity";
import type { Group } from "@semaphore-protocol/group";
import { generateProof } from "@semaphore-protocol/proof";

export interface SemaphoreProofResult {
  proof: string;
  nullifierHash: string;
  merkleTreeRoot: string;
}

/**
 * Generate Semaphore ZK proof for registration.
 * Proves: "I am a member of the anonymity set" + nullifier for sp_id (Sybil resistance).
 */
export async function generateSemaphoreProof(
  identity: Identity,
  group: Group,
  spId: string,
  message: string = ""
): Promise<SemaphoreProofResult> {
  const fullProof = await generateProof(
    identity,
    group,
    message,
    spId, // scope = external nullifier (one per SP)
    20 // merkle tree depth
  );

  return {
    proof: JSON.stringify(fullProof, (_, v) => (typeof v === "bigint" ? v.toString() : v)),
    nullifierHash: String(fullProof.nullifier),
    merkleTreeRoot: String(fullProof.merkleTreeRoot),
  };
}

/**
 * Generate Semaphore ZK proof for DAO voting.
 * scope = proposalId (external nullifier per proposal)
 * message = voteChoice ("0"=Yes, "1"=No, "2"=Abstain)
 */
export async function generateSemaphoreProofForVote(
  identity: Identity,
  group: Group,
  proposalId: number,
  voteChoice: number
): Promise<SemaphoreProofResult> {
  const scope = String(proposalId);
  const message = String(voteChoice);
  const fullProof = await generateProof(identity, group, message, scope, 20);
  // JSON.stringify fails on BigInt; use replacer for Semaphore proof
  const proofJson = JSON.stringify(fullProof, (_, v) =>
    typeof v === "bigint" ? v.toString() : v
  );
  return {
    proof: proofJson,
    nullifierHash: String(fullProof.nullifier),
    merkleTreeRoot: String(fullProof.merkleTreeRoot),
  };
}
