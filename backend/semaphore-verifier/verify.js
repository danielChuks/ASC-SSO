#!/usr/bin/env node
/**
 * Verifies a Semaphore ZK proof. Called by Python backend.
 * Usage: node verify.js < proof.json
 * Reads proof JSON from stdin, outputs {"verified": true|false} to stdout.
 */
import { verifyProof } from "@semaphore-protocol/proof";

async function main() {
  try {
    let input = "";
    for await (const chunk of process.stdin) {
      input += chunk;
    }
    const payload = JSON.parse(input);

    // Semaphore v4: proof can be full SemaphoreProof { points, nullifier, merkleTreeRoot, ... }
    const semaphoreProof =
      payload.proof?.points != null
        ? payload.proof
        : {
            merkleTreeDepth: 20,
            merkleTreeRoot: payload.merkleTreeRoot,
            nullifier: payload.nullifierHash,
            message: payload.message || "0",
            scope: payload.scope,
            points: payload.proof,
          };

    const verified = await verifyProof(semaphoreProof);
    console.log(JSON.stringify({ verified }));
  } catch (err) {
    console.error(JSON.stringify({ verified: false, error: err.message }));
    process.exit(1);
  }
}

main();