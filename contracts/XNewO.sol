// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Inheritance
import "./LpRewards.sol";

contract XNewO is LpRewards("xNewO", "xNWO") {
    constructor(
        address _owner,
        address _lp,
        address _rewardsToken,
        address _veTokenVault,
        address _rewardsDistribution
    ) Owned (_owner) {
        _assetTokenAddress = _lp;
        rewardsToken = _rewardsToken;
        veTokenVault = _veTokenVault;
        rewardsDistribution = _rewardsDistribution;
    }
}