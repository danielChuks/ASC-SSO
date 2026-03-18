#!/usr/bin/env node
import { verifyProof } from "@semaphore-protocol/proof";
import * as fs from "fs";

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

async function main() {
  try {
    const filePath = process.argv[2];
    const input = filePath ? fs.readFileSync(filePath, "utf-8") : await readStdin();
    if (!input || !input.trim()) {
      throw new Error("No verifier payload provided");
    }
    const payload = JSON.parse(input);

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
    
    // 1. Print the result for Python to read
    console.log(JSON.stringify({ verified }));
    
    // 2. FORCE NODE TO KILL ALL SNARKJS THREADS AND EXIT
    process.exit(0); 

  } catch (err) {
    console.error(JSON.stringify({ verified: false, error: err.message }));
    process.exit(1);
  }
}

main();
