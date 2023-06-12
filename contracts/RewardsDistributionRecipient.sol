// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

// Inheritance
import {Owned} from "./Owned.sol";

// Errors
error OnlyRewardsDistribution();
error RewardsCannotBeZero();

// https://docs.synthetix.io/contracts/source/contracts/RewardsDistributionRecipient
abstract contract RewardsDistributionRecipient is Owned {
    address public rewardsDistribution;

    function notifyRewardAmount(uint256 reward) external virtual;

    modifier onlyRewardsDistribution() {
        if (msg.sender != rewardsDistribution) revert OnlyRewardsDistribution();
        _;
    }

    function setRewardsDistribution(
        address _rewardsDistribution
    ) external onlyOwner {
        if (_rewardsDistribution == address(0)) revert RewardsCannotBeZero();
        rewardsDistribution = _rewardsDistribution;
    }
}
