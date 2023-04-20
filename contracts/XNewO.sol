// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

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
        assetToken = _lp;
        rewardsToken = _rewardsToken;
        veVault = _veTokenVault;
        rewardsDistribution = _rewardsDistribution;
    }
}