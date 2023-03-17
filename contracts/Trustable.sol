// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

// Inheritance
import "./Owned.sol";

// Custom errors
error AlreadyTrustedProxy();
error NotTrustedProxy();

abstract contract Trustable is Owned{
	mapping (address => bool) public trustedProxies;	// trusted proxies allowed to call the contract functions.

    /**
     * @dev Only trusted proxies can call the functions
     * defined in the contract that inherits from Trustable.
     */
    modifier onlyTrustedProxies(address caller) {
      if (!trustedProxies[caller]) revert NotTrustedProxy();
      _;
    }

    /**
     * @notice Add a trusted proxy.
     */
    function addTrustedProxy(address trustedAddress) external onlyOwner {
      if (trustedProxies[trustedAddress]) revert AlreadyTrustedProxy();
		  trustedProxies[trustedAddress] = true;
    }

    /**
     * @notice Remove a trusted proxy.
     */
    function removeTrustedProxy(address toRemove) external onlyOwner {
      if (!trustedProxies[toRemove]) revert NotTrustedProxy();
		  trustedProxies[toRemove] = false;
    }
}