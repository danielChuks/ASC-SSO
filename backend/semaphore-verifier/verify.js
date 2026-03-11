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
    const { proof, nullifierHash, merkleTreeRoot, scope, message } = JSON.parse(input);

    const fullProof = {
      proof,
      publicSignals: {
        merkleTreeRoot,
        nullifierHash,
        message: message || "0",
        scope,
      },
    };

    const verified = await verifyProof(fullProof);
    console.log(JSON.stringify({ verified }));
  } catch (err) {
    console.error(JSON.stringify({ verified: false, error: err.message }));
    process.exit(1);
  }
}

main();
