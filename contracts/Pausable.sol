// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

// Inheritance
import "./Owned.sol";

// https://docs.synthetix.io/contracts/source/contracts/Pausable
abstract contract Pausable is Owned {
    uint public lastPauseTime;
    bool public paused;

    error OwnerNotSet();
    error Paused();

    constructor() {
        // This contract is abstract, and thus cannot be instantiated directly
        if (owner == address(0))
            revert OwnerNotSet();
        // Paused will be false, and lastPauseTime will be 0 upon initialisation
    }

    /**
     * @notice Change the paused state of the contract
     * @dev Only the contract owner may call this.
     */
    function setPaused(bool _paused) external onlyOwner {
        // Ensure we're actually changing the state before we do anything
        if (_paused == paused) {
            return;
        }

        // Set our paused state.
        paused = _paused;

        // If applicable, set the last pause time.
        if (paused) {
            lastPauseTime = block.timestamp;
        }

        // Let everyone know that our pause state has changed.
        emit PauseChanged(paused);
    }

    event PauseChanged(bool isPaused);

    modifier notPaused {
        if (paused)
            revert Paused();
        _;
    }
}
