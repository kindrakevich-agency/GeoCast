// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Tiny Merkle tree helper for tests. Mirrors OpenZeppelin's
///         standard verification (sorted pair hashing). Not for production —
///         only used to build trees in Foundry tests.
library Merkle {
    function getRoot(bytes32[] memory leaves) internal pure returns (bytes32) {
        if (leaves.length == 0) return bytes32(0);
        if (leaves.length == 1) return leaves[0];

        bytes32[] memory layer = leaves;
        while (layer.length > 1) {
            uint256 nextLen = (layer.length + 1) / 2;
            bytes32[] memory next = new bytes32[](nextLen);
            for (uint256 i = 0; i < nextLen; i++) {
                uint256 l = 2 * i;
                uint256 r = l + 1;
                bytes32 left = layer[l];
                bytes32 right = r < layer.length ? layer[r] : layer[l];
                next[i] = _hashPair(left, right);
            }
            layer = next;
        }
        return layer[0];
    }

    function getProof(bytes32[] memory leaves, uint256 index)
        internal
        pure
        returns (bytes32[] memory)
    {
        require(index < leaves.length, "oob");

        // Worst case: ceil(log2(n)) levels.
        bytes32[] memory proof = new bytes32[](32);
        uint256 proofLen = 0;

        bytes32[] memory layer = leaves;
        uint256 idx = index;
        while (layer.length > 1) {
            uint256 sibling = idx ^ 1;
            if (sibling < layer.length) {
                proof[proofLen++] = layer[sibling];
            }
            uint256 nextLen = (layer.length + 1) / 2;
            bytes32[] memory next = new bytes32[](nextLen);
            for (uint256 i = 0; i < nextLen; i++) {
                uint256 l = 2 * i;
                uint256 r = l + 1;
                bytes32 left = layer[l];
                bytes32 right = r < layer.length ? layer[r] : layer[l];
                next[i] = _hashPair(left, right);
            }
            layer = next;
            idx /= 2;
        }

        bytes32[] memory trimmed = new bytes32[](proofLen);
        for (uint256 i = 0; i < proofLen; i++) trimmed[i] = proof[i];
        return trimmed;
    }

    function _hashPair(bytes32 a, bytes32 b) private pure returns (bytes32) {
        return a < b ? keccak256(abi.encodePacked(a, b)) : keccak256(abi.encodePacked(b, a));
    }
}
