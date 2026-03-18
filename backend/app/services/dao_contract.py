"""On-chain DAO Voting contract client."""
from __future__ import annotations

from typing import Optional

from web3 import Web3

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
        "inputs": [
            {"internalType": "uint256", "name": "proposalId", "type": "uint256"},
            {"internalType": "uint8", "name": "voteChoice", "type": "uint8"},
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

    def cast_vote(self, proposal_id: int, vote_choice: int) -> str:
        """Submit vote as relayer. vote_choice: 0=Yes, 1=No, 2=Abstain. Returns tx hash."""
        if not self._relayer_key:
            raise ValueError("Relayer private key required for castVote")
        if vote_choice not in (0, 1, 2):
            raise ValueError("Invalid vote choice (0=Yes, 1=No, 2=Abstain)")
        acct = self.w3.eth.account.from_key(self._relayer_key)
        nonce = self.w3.eth.get_transaction_count(acct.address)
        gas_price = self.w3.eth.gas_price or 10**9  # fallback if None/0
        tx = self.contract.functions.castVote(proposal_id, vote_choice).build_transaction(
            {
                "from": acct.address,
                "nonce": nonce,
                "gas": 200_000,
                "gasPrice": gas_price,
            }
        )
        signed = acct.sign_transaction(tx)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
        if receipt["status"] != 1:
            raise RuntimeError("castVote transaction failed")
        return receipt["transactionHash"].hex()
