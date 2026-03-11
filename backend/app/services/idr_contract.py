"""On-chain IdR (Identity Registry) via Solidity CommitmentRegistry contract."""
from __future__ import annotations

from typing import Optional

from web3 import Web3

# ABI for CommitmentRegistry - addCommitment, hasCommitment, getSemaphoreCommitments, getSize
COMMITMENT_REGISTRY_ABI = [
    {
        "inputs": [{"internalType": "uint256", "name": "commitment", "type": "uint256"}, {"internalType": "bool", "name": "isSemaphore", "type": "bool"}],
        "name": "addCommitment",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [{"internalType": "uint256", "name": "commitment", "type": "uint256"}],
        "name": "hasCommitment",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "getSemaphoreCommitments",
        "outputs": [{"internalType": "uint256[]", "name": "", "type": "uint256[]"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "getSize",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
]


def _commitment_to_uint(commitment: str) -> int:
    """Convert commitment string (decimal or hex) to int for Solidity uint256."""
    s = commitment.strip().lower()
    if s.startswith("0x") or all(c in "0123456789abcdef" for c in s) and len(s) == 64:
        return int(s, 16)
    return int(s, 10)


def _uint_to_commitment(val: int) -> str:
    """Convert uint256 back to string (decimal for Semaphore, hex for HMAC)."""
    return str(val)


class IdRContract:
    """Client for on-chain CommitmentRegistry."""

    def __init__(self, rpc_url: str, contract_address: str, deployer_private_key: Optional[str] = None):
        self.w3 = Web3(Web3.HTTPProvider(rpc_url))
        if not self.w3.is_connected():
            raise ValueError(f"Cannot connect to Ethereum node at {rpc_url}")
        self.contract = self.w3.eth.contract(
            address=Web3.to_checksum_address(contract_address),
            abi=COMMITMENT_REGISTRY_ABI,
        )
        self._deployer_key = deployer_private_key

    def has_commitment(self, commitment: str) -> bool:
        """Check if commitment exists on-chain."""
        val = _commitment_to_uint(commitment)
        return self.contract.functions.hasCommitment(val).call()

    def add_commitment(self, commitment: str, is_semaphore: bool) -> int:
        """Add commitment. Requires deployer key for write. Returns index."""
        if not self._deployer_key:
            raise ValueError("Deployer private key required for addCommitment")
        val = _commitment_to_uint(commitment)
        acct = self.w3.eth.account.from_key(self._deployer_key)
        tx = self.contract.functions.addCommitment(val, is_semaphore).build_transaction(
            {"from": acct.address, "gas": 200_000}
        )
        signed = acct.sign_transaction(tx)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
        if receipt["status"] != 1:
            raise RuntimeError("Transaction failed")
        # Index is length - 1
        size = self.contract.functions.getSize().call()
        return size - 1

    def get_semaphore_commitments(self) -> list[str]:
        """Get commitments for ZK anonymity group (Semaphore only)."""
        vals = self.contract.functions.getSemaphoreCommitments().call()
        return [_uint_to_commitment(v) for v in vals]


def is_hmac_commitment(c: str) -> bool:
    """HMAC commitments are 64 hex chars; Semaphore are decimal bigints."""
    return len(c) == 64 and all(x in "0123456789abcdef" for x in c.lower())
