// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

// Inheritance
import "./Owned.sol";

// https://docs.synthetix.io/contracts/source/contracts/RewardsDistributionRecipient
abstract contract RewardsDistributionRecipient is Owned {
    address public rewardsDistribution;

    error OnlyRewardsDistribution();
    error RewardsCannotBeZero();

    function notifyRewardAmount(uint256 reward) virtual external;

    modifier onlyRewardsDistribution() {
        if (msg.sender != rewardsDistribution)
            revert OnlyRewardsDistribution();
        _;
    }

    function setRewardsDistribution(address _rewardsDistribution) external onlyOwner {
        if (_rewardsDistribution == address(0)) revert RewardsCannotBeZero();
        rewardsDistribution = _rewardsDistribution;
    }
}