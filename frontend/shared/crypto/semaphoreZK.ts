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

  const ps = fullProof.publicSignals as { nullifierHash: bigint; merkleTreeRoot: bigint };
  return {
    proof: JSON.stringify(fullProof.proof),
    nullifierHash: ps.nullifierHash.toString(),
    merkleTreeRoot: ps.merkleTreeRoot.toString(),
  };
}
