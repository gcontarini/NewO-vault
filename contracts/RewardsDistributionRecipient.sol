// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

// Inheritance
import "./Owned.sol";

// https://docs.synthetix.io/contracts/source/contracts/RewardsDistributionRecipient
abstract contract RewardsDistributionRecipient is Owned {
    address public rewardsDistribution;

    function notifyRewardAmount(uint256 reward) virtual external;

    modifier onlyRewardsDistribution() {
        require(msg.sender == rewardsDistribution, "Caller is not RewardsDistribution contract");
        _;
    }

    function setRewardsDistribution(address _rewardsDistribution) external onlyOwner {
        rewardsDistribution = _rewardsDistribution;
    }
}