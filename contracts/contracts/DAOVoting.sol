// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * Current phase:
 * - Proposals and tallies are stored on-chain.
 * - ZK proof verification and nullifier uniqueness stay in the backend/PostgreSQL.
 * - A trusted vote relayer submits accepted votes on-chain.
 *
 * Planned upgrade:
 * - Move nullifier registry and proof verification on-chain.
 *- have commented out that part for now 
 */
contract DAOVoting {
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    enum VoteChoice {
        Yes,
        No,
        Abstain
    }

    struct Proposal {
        uint256 id;
        string description;
        bytes32 snapshotRoot;
        uint64 startTime; // Unix timestamp in seconds.
        uint64 endTime; // Unix timestamp in seconds.
        bool exists;
        bool finalized;
        uint256 yesVotes;
        uint256 noVotes;
        uint256 abstainVotes;
    }

    address public owner;
    address public voteRelayer;
    uint256 private _status;

    mapping(uint256 => Proposal) private _proposals;
    uint256[] private _proposalIds;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event VoteRelayerUpdated(address indexed previousRelayer, address indexed newRelayer);
    event ProposalCreated(
        uint256 indexed proposalId,
        bytes32 indexed snapshotRoot,
        uint64 startTime,
        uint64 endTime,
        string description
    );
    event VoteCast(uint256 indexed proposalId, uint8 voteChoice);
    event ProposalFinalized(uint256 indexed proposalId, uint256 yesVotes, uint256 noVotes, uint256 abstainVotes);

    error Unauthorized();
    error InvalidAddress();
    error ProposalAlreadyExists();
    error ProposalNotFound();
    error InvalidTimeWindow();
    error VotingNotOpen();
    error VotingStillOpen();
    error ProposalFinalizedAlready();
    error InvalidVoteChoice();
    error ReentrantCall();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier nonReentrant() {
        if (_status == _ENTERED) revert ReentrantCall();
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    modifier onlyVoteRelayer() {
        if (msg.sender != voteRelayer) revert Unauthorized();
        _;
    }

    modifier proposalExists(uint256 proposalId) {
        if (!_proposals[proposalId].exists) revert ProposalNotFound();
        _;
    }

    constructor(address initialVoteRelayer) {
        if (initialVoteRelayer == address(0)) revert InvalidAddress();

        owner = msg.sender;
        voteRelayer = initialVoteRelayer;
        _status = _NOT_ENTERED;

        emit OwnershipTransferred(address(0), owner);
        emit VoteRelayerUpdated(address(0), initialVoteRelayer);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();

        address previousOwner = owner;
        owner = newOwner;

        emit OwnershipTransferred(previousOwner, newOwner);
    }

    function setVoteRelayer(address newVoteRelayer) external onlyOwner {
        if (newVoteRelayer == address(0)) revert InvalidAddress();

        address previousRelayer = voteRelayer;
        voteRelayer = newVoteRelayer;

        emit VoteRelayerUpdated(previousRelayer, newVoteRelayer);
    }

    /**
     *  Create a proposal and freeze the eligibility snapshot reference.
     *      In the current PoC, backend proof verification still uses the off-chain
     *      commitment group and PostgreSQL nullifier registry.
     */
    function createProposal(
        uint256 proposalId,
        string calldata description,
        bytes32 snapshotRoot,
        uint64 startTime, 
        uint64 endTime
    ) external onlyOwner nonReentrant {
        if (_proposals[proposalId].exists) revert ProposalAlreadyExists();
        if (endTime <= startTime) revert InvalidTimeWindow();

        _proposals[proposalId] = Proposal({
            id: proposalId,
            description: description,
            snapshotRoot: snapshotRoot,
            startTime: startTime,
            endTime: endTime,
            exists: true,
            finalized: false,
            yesVotes: 0,
            noVotes: 0,
            abstainVotes: 0
        });

        _proposalIds.push(proposalId);

        emit ProposalCreated(proposalId, snapshotRoot, startTime, endTime, description);
    }

    /**
     *  Record a vote that has already been accepted by the backend.
     *  The backend is currently responsible for:
     *      1. verifying the Semaphore proof
     *      2. checking nullifier uniqueness in PostgreSQL
     *      3. relaying only accepted votes to this contract
     *
     *      The `nullifierHash` and `proof` arguments are kept in the function
     *      signature so the frontend/backend integration can already match the
     *      long-term API shape from the docs.
     */
    // function castVote(
    //     uint256 proposalId,
    //     VoteChoice voteChoice,
    //     bytes32 nullifierHash,
    //     bytes calldata proof
    // ) external onlyVoteRelayer nonReentrant proposalExists(proposalId) {
    //     Proposal storage proposal = _proposals[proposalId];

    //     if (proposal.finalized) revert ProposalFinalizedAlready();
    //     if (block.timestamp < proposal.startTime || block.timestamp > proposal.endTime) revert VotingNotOpen();
    //     if (uint8(voteChoice) > uint8(VoteChoice.Abstain)) revert InvalidVoteChoice();

    //     // Silence warnings while the PoC keeps proof/nullifier handling off-chain.
    //     nullifierHash;
    //     proof;

    //     // Planned on-chain nullifier registry upgrade:
    //     // require(!_usedNullifiers[proposalId][nullifierHash], "Nullifier already used");
    //     // _usedNullifiers[proposalId][nullifierHash] = true;

    //     // Planned on-chain proof verification upgrade:
    //     // require(
    //     //     semaphoreVerifier.verifyProof(proposal.snapshotRoot, proposalId, nullifierHash, proof),
    //     //     "Invalid ZK proof"
    //     // );

    //     if (voteChoice == VoteChoice.Yes) {
    //         proposal.yesVotes += 1;
    //     } else if (voteChoice == VoteChoice.No) {
    //         proposal.noVotes += 1;
    //     } else {
    //         proposal.abstainVotes += 1;
    //     }

    //     emit VoteCast(proposalId, uint8(voteChoice));
    // }
        function castVote(
        uint256 proposalId,
        VoteChoice voteChoice
    ) external onlyVoteRelayer nonReentrant proposalExists(proposalId) {
        Proposal storage proposal = _proposals[proposalId];

        if (proposal.finalized) revert ProposalFinalizedAlready();
        if (block.timestamp < proposal.startTime || block.timestamp > proposal.endTime) revert VotingNotOpen();
        if (uint8(voteChoice) > uint8(VoteChoice.Abstain)) revert InvalidVoteChoice();

        // Silence warnings while the PoC keeps proof/nullifier handling off-chain.
        // nullifierHash;
        // proof;

        // Planned on-chain nullifier registry upgrade:
        // require(!_usedNullifiers[proposalId][nullifierHash], "Nullifier already used");
        // _usedNullifiers[proposalId][nullifierHash] = true;

        // Planned on-chain proof verification upgrade:
        // require(
        //     semaphoreVerifier.verifyProof(proposal.snapshotRoot, proposalId, nullifierHash, proof),
        //     "Invalid ZK proof"
        // );

        if (voteChoice == VoteChoice.Yes) {
            proposal.yesVotes += 1;
        } else if (voteChoice == VoteChoice.No) {
            proposal.noVotes += 1;
        } else {
            proposal.abstainVotes += 1;
        }

        emit VoteCast(proposalId, uint8(voteChoice));
    }

    function finalizeProposal(uint256 proposalId) external onlyOwner nonReentrant proposalExists(proposalId) {
        Proposal storage proposal = _proposals[proposalId];

        if (proposal.finalized) revert ProposalFinalizedAlready();
        if (block.timestamp <= proposal.endTime) revert VotingStillOpen();

        proposal.finalized = true;

        emit ProposalFinalized(proposalId, proposal.yesVotes, proposal.noVotes, proposal.abstainVotes);
    }

    function getProposal(uint256 proposalId)
        external
        view
        proposalExists(proposalId)
        returns (
            uint256 id,
            string memory description,
            bytes32 snapshotRoot,
            uint64 startTime,
            uint64 endTime,
            bool finalized,
            uint256 yesVotes,
            uint256 noVotes,
            uint256 abstainVotes
        )
    {
        Proposal storage proposal = _proposals[proposalId];

        return (
            proposal.id,
            proposal.description,
            proposal.snapshotRoot,
            proposal.startTime,
            proposal.endTime,
            proposal.finalized,
            proposal.yesVotes,
            proposal.noVotes,
            proposal.abstainVotes
        );
    }

    function getProposalIds() external view returns (uint256[] memory) {
        return _proposalIds;
    }

    function tallyVotes(uint256 proposalId)
        external
        view
        proposalExists(proposalId)
        returns (uint256 yesVotes, uint256 noVotes, uint256 abstainVotes)
    {
        Proposal storage proposal = _proposals[proposalId];
        return (proposal.yesVotes, proposal.noVotes, proposal.abstainVotes);
    }

    function isVotingOpen(uint256 proposalId) external view proposalExists(proposalId) returns (bool) {
        Proposal storage proposal = _proposals[proposalId];
        return !proposal.finalized && block.timestamp >= proposal.startTime && block.timestamp <= proposal.endTime;
    }

    // Planned on-chain nullifier registry:
    // mapping(uint256 => mapping(bytes32 => bool)) private _usedNullifiers;
    //
    // function hasNullifierBeenUsed(uint256 proposalId, bytes32 nullifierHash)
    //     external
    //     view
    //     returns (bool)
    // {
    //     return _usedNullifiers[proposalId][nullifierHash];
    // }
}
