// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

// Inheritance
import "./Owned.sol";

// Custom errors
error AlreadyTrustedController();
error NotTrustedController();

abstract contract Trustable is Owned {
    mapping(address => bool) public trustedControllers; // trusted controllers allowed to call the contract functions.

    /**
     * @dev Only trusted controllers can call the functions
     * defined in the contract that inherits from Trustable.
     */
    modifier onlyTrustedControllers() {
        if (!trustedControllers[msg.sender]) revert NotTrustedController();
        _;
    }

    /**
     * @notice Add a trusted controller.
     * @param trustedAddress The address of a trusted controller to add.
     */
    function addTrustedController(address trustedAddress) external onlyOwner {
        if (trustedAddress == address(0)) revert OwnerCannotBeZero();
        if (trustedControllers[trustedAddress])
            revert AlreadyTrustedController();
        trustedControllers[trustedAddress] = true;
    }

    /**
     * @notice Remove a trusted controller.
     * @param toRemove The address of a trusted controller to remove.
     */
    function removeTrustedController(address toRemove) external onlyOwner {
        if (!trustedControllers[toRemove]) revert NotTrustedController();
        trustedControllers[toRemove] = false;
    }

    function isControllerTrusted(
        address controller
    ) external view returns (bool) {
        return trustedControllers[controller];
    }
}
