// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * CommitmentRegistry - On-chain IdR (Identity Registry) for ShieldLogin.
 * Stores Semaphore commitments for anonymity set / Merkle tree in ZK proofs.
 */
contract CommitmentRegistry {
    struct Entry {
        uint256 commitment;
        bool isSemaphore; // true = Semaphore (in group), false = HMAC/legacy (excluded)
    }

    Entry[] private _entries;
    mapping(uint256 => bool) private _exists;

    event CommitmentAdded(uint256 indexed commitment, uint256 index);
    event CommitmentRevoked(uint256 indexed index);

    /// @notice Add a commitment. isSemaphore=true includes it in getSemaphoreCommitments() for ZK group.
    function addCommitment(uint256 commitment, bool isSemaphore) external returns (uint256) {
        require(!_exists[commitment], "Commitment already registered");
        _exists[commitment] = true;
        uint256 idx = _entries.length;
        _entries.push(Entry(commitment, isSemaphore));
        emit CommitmentAdded(commitment, idx);
        return idx;
    }

    /// @notice Check if a commitment exists.
    function hasCommitment(uint256 commitment) external view returns (bool) {
        return _exists[commitment];
    }

    /// @notice Get commitment at index.
    function getCommitment(uint256 index) external view returns (uint256 commitment, bool isSemaphore) {
        require(index < _entries.length, "Index out of bounds");
        Entry storage e = _entries[index];
        return (e.commitment, e.isSemaphore);
    }

    /// @notice Get total count.
    function getSize() external view returns (uint256) {
        return _entries.length;
    }

    /// @notice Get all Semaphore commitments (for ZK anonymity group). Order preserved.
    function getSemaphoreCommitments() external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < _entries.length; i++) {
            if (_entries[i].isSemaphore) count++;
        }
        uint256[] memory out = new uint256[](count);
        uint256 j = 0;
        for (uint256 i = 0; i < _entries.length; i++) {
            if (_entries[i].isSemaphore) {
                out[j++] = _entries[i].commitment;
            }
        }
        return out;
    }

    /// @notice Revoke by index (sets isSemaphore=false, keeps existence for hasCommitment).
    function revoke(uint256 index) external {
        require(index < _entries.length, "Index out of bounds");
        _entries[index].isSemaphore = false;
        emit CommitmentRevoked(index);
    }
}
