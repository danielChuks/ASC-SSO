"""On-chain DAO Voting contract client."""
from __future__ import annotations

from typing import Optional

from web3 import Web3
from web3.exceptions import ContractLogicError, Web3RPCError

# ABI for DAOVoting - getProposal, getProposalIds, castVote, isVotingOpen
DAOVOTING_ABI = [
    {
        "inputs": [{"internalType": "uint256", "name": "proposalId", "type": "uint256"}],
        "name": "getProposal",
        "outputs": [
            {"internalType": "uint256", "name": "id", "type": "uint256"},
            {"internalType": "string", "name": "description", "type": "string"},
            {"internalType": "bytes32", "name": "snapshotRoot", "type": "bytes32"},
            {"internalType": "uint64", "name": "startTime", "type": "uint64"},
            {"internalType": "uint64", "name": "endTime", "type": "uint64"},
            {"internalType": "bool", "name": "finalized", "type": "bool"},
            {"internalType": "uint256", "name": "yesVotes", "type": "uint256"},
            {"internalType": "uint256", "name": "noVotes", "type": "uint256"},
            {"internalType": "uint256", "name": "abstainVotes", "type": "uint256"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "getProposalIds",
        "outputs": [{"internalType": "uint256[]", "name": "", "type": "uint256[]"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [{"internalType": "uint256", "name": "proposalId", "type": "uint256"}],
        "name": "isVotingOpen",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "voteRelayer",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "uint256", "name": "proposalId", "type": "uint256"},
            {"internalType": "uint8", "name": "voteChoice", "type": "uint8"},
        ],
        "name": "castVote",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "uint256", "name": "proposalId", "type": "uint256"},
            {"internalType": "uint8", "name": "voteChoice", "type": "uint8"},
            {"internalType": "bytes32", "name": "nullifierHash", "type": "bytes32"},
            {"internalType": "bytes", "name": "proof", "type": "bytes"},
        ],
        "name": "castVote",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
]


class DaoVotingContract:
    """Client for on-chain DAOVoting contract."""

    def __init__(
        self,
        rpc_url: str,
        contract_address: str,
        relayer_private_key: Optional[str] = None,
    ):
        self.w3 = Web3(Web3.HTTPProvider(rpc_url))
        if not self.w3.is_connected():
            raise ValueError(f"Cannot connect to Ethereum node at {rpc_url}")
        self.contract = self.w3.eth.contract(
            address=Web3.to_checksum_address(contract_address),
            abi=DAOVOTING_ABI,
        )
        self._relayer_key = relayer_private_key

    def get_proposal_ids(self) -> list[int]:
        """Get all proposal IDs."""
        ids = self.contract.functions.getProposalIds().call()
        return [int(x) for x in ids]

    def is_voting_open(self, proposal_id: int) -> bool:
        """Check if voting is open for a proposal."""
        return self.contract.functions.isVotingOpen(proposal_id).call()

    def get_proposal(
        self, proposal_id: int
    ) -> tuple[str, bytes, int, int, bool, int, int, int]:
        """Get proposal details. Returns (description, snapshotRoot, startTime, endTime, finalized, yesVotes, noVotes, abstainVotes)."""
        result = self.contract.functions.getProposal(proposal_id).call()
        return (
            result[1],  # description
            result[2],  # snapshotRoot
            result[3],  # startTime
            result[4],  # endTime
            result[5],  # finalized
            result[6],  # yesVotes
            result[7],  # noVotes
            result[8],  # abstainVotes
        )

    @staticmethod
    def _to_bytes32(value: str) -> str:
        """Convert decimal or hex string into 0x-prefixed 32-byte hex."""
        raw = value.strip()
        if raw.startswith("0x"):
            hex_part = raw[2:]
            if len(hex_part) > 64:
                raise ValueError("nullifier hash too large for bytes32")
            return "0x" + hex_part.rjust(64, "0")
        number = int(raw, 10)
        if number < 0 or number >= 2**256:
            raise ValueError("nullifier hash out of bytes32 range")
        return "0x" + format(number, "064x")

    @staticmethod
    def _is_selector_mismatch(error: Exception) -> bool:
        msg = str(error).lower()
        return "function selector was not recognized" in msg or "no fallback function" in msg

    def _preflight_or_raise(self, func_call, from_addr: str) -> None:
        """Dry-run call to get revert reason before sending tx."""
        try:
            func_call.call({"from": from_addr})
        except ContractLogicError as err:
            raise ValueError(f"castVote preflight reverted: {err}") from err
        except Exception as err:  # pragma: no cover
            raise ValueError(f"castVote preflight failed: {err}") from err

    def cast_vote(
        self,
        proposal_id: int,
        vote_choice: int,
        nullifier_hash: str,
        proof: bytes = b"",
    ) -> str:
        """Submit vote as relayer. vote_choice: 0=Yes, 1=No, 2=Abstain. Returns tx hash."""
        if not self._relayer_key:
            raise ValueError("Relayer private key required for castVote")
        if vote_choice not in (0, 1, 2):
            raise ValueError("Invalid vote choice (0=Yes, 1=No, 2=Abstain)")
        nullifier_bytes32 = self._to_bytes32(nullifier_hash)
        relayer_key = self._relayer_key.strip()
        if relayer_key.startswith("0x") and len(relayer_key) == 42:
            raise ValueError(
                "DAO_VOTE_RELAYER must be a private key, not a wallet address. "
                "Use a 32-byte hex private key (0x + 64 hex chars)."
            )
        try:
            acct = self.w3.eth.account.from_key(relayer_key)
        except Exception as err:  # pragma: no cover - web3 error shape varies
            raise ValueError(
                "Invalid DAO_VOTE_RELAYER private key format. "
                "Expected 32-byte hex private key (0x + 64 hex chars)."
            ) from err

        # If contract exposes voteRelayer(), verify backend key matches the configured relayer.
        try:
            configured_relayer = self.contract.functions.voteRelayer().call()
            if configured_relayer.lower() != acct.address.lower():
                raise ValueError(
                    f"Relayer mismatch: contract expects {configured_relayer}, "
                    f"but backend key resolves to {acct.address}"
                )
        except ValueError:
            raise
        except Exception:
            # Older contract variants may not expose voteRelayer().
            pass

        nonce = self.w3.eth.get_transaction_count(acct.address)
        gas_price = self.w3.eth.gas_price or 10**9  # fallback if None/0
        tx_common = {
            "from": acct.address,
            "nonce": nonce,
            "gas": 300_000,
            "gasPrice": gas_price,
        }

        # Try both deployed variants, then bubble combined reason.
        errors = []

        try:
            call_4arg = self.contract.get_function_by_signature(
                "castVote(uint256,uint8,bytes32,bytes)"
            )(proposal_id, vote_choice, nullifier_bytes32, proof)
            self._preflight_or_raise(call_4arg, acct.address)
            tx = call_4arg.build_transaction(tx_common)
            signed = acct.sign_transaction(tx)
            tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
            if receipt["status"] != 1:
                raise RuntimeError("castVote transaction failed (4-arg)")
            return receipt["transactionHash"].hex()
        except Exception as err:  # pragma: no cover - fallback path
            errors.append(f"4-arg castVote failed: {err}")

        try:
            nonce = self.w3.eth.get_transaction_count(acct.address)
            tx_common["nonce"] = nonce
            call_2arg = self.contract.get_function_by_signature("castVote(uint256,uint8)")(
                proposal_id,
                vote_choice,
            )
            self._preflight_or_raise(call_2arg, acct.address)
            tx = call_2arg.build_transaction(tx_common)
            signed = acct.sign_transaction(tx)
            tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
            if receipt["status"] != 1:
                raise RuntimeError("castVote transaction failed (2-arg)")
            return receipt["transactionHash"].hex()
        except Exception as err:
            errors.append(f"2-arg castVote failed: {err}")

        raise ValueError(" ; ".join(errors))
