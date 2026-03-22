"""Semaphore ZK proof verification via Node.js subprocess."""
import json
import os
import subprocess
from pathlib import Path


def _get_node_binary() -> str:
    """Resolve Node.js binary path. Use NODE_BINARY env if Python can't find node (e.g. on deploy)."""
    from app.config import Settings

    s = Settings.load()
    if s.node_binary:
        return os.path.expanduser(s.node_binary)
    import shutil

    return shutil.which("node") or "node"


def verify_semaphore_proof(
    proof_json: str,
    nullifier_hash: str,
    merkle_root: str,
    scope: str,
    message: str = "0",
) -> bool:
    """Verify Semaphore ZK proof via Node.js subprocess."""
    verifier_dir = Path(__file__).resolve().parent.parent.parent / "semaphore-verifier"
    verify_js = verifier_dir / "verify.js"
    if not verify_js.exists():
        raise RuntimeError("Semaphore verifier not found. Run: cd backend/semaphore-verifier && npm install")

    payload = json.dumps({
        "proof": json.loads(proof_json),
        "nullifierHash": nullifier_hash,
        "merkleTreeRoot": merkle_root,
        "scope": scope,
        "message": message,
    })
    node_bin = _get_node_binary()
    try:
        result = subprocess.run(
            [node_bin, str(verify_js)],
            input=payload,
            capture_output=True,
            text=True,
            cwd=str(verifier_dir),
            timeout=30,
        )
        if result.returncode != 0:
            return False
        out = json.loads(result.stdout)
        return out.get("verified", False)
    except Exception:
        return False
