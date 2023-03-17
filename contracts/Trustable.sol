// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

// Inheritance
import "./Owned.sol";

abstract contract Trustable is Owned{
	mapping (address => bool) public trustedProxies;	// trusted proxies allowed to call the contract functions.

    /**
     * @dev Only trusted proxies can call the functions
     * defined in the contract that inherits from Trustable.
     */
    modifier onlyTrustedProxies(address caller) {
        require(trustedProxies[caller], "Caller is not a trusted proxy.");
        _;
    }

    /**
     * @notice Add a trusted proxy.
     */
    function addTrustedProxy(address trustedAddress) external onlyOwner {
		require(!trustedProxies[trustedAddress], "Proxy is already trusted.");
		trustedProxies[trustedAddress] = true;
    }

    /**
     * @notice Remove a trusted proxy.
     */
    function removeTrustedProxy(address toRemove) external onlyOwner {
		require(trustedProxies[toRemove], "Proxy is not trusted.");
		trustedProxies[toRemove] = false;
    }
}