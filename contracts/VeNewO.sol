// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

// Inheritance
import "./VeVault.sol";

contract VeNewO is VeVault("veNewO", "veNWO") {
    constructor(
        address owner_,
        address stakingToken_,
        uint256 gracePeriod_,
        uint256 minLockTime_,
        uint256 maxLockTime_,
        uint256 penaltyPerc_,
        uint256 maxPenalty_,
        uint256 minPenalty_,
        uint256 epoch_
    ) Owned(owner_) {
        // assetToken = IERC20(stakingToken_);
        _assetTokenAddress = stakingToken_;

        _lockTimer.min = minLockTime_;
        _lockTimer.max = maxLockTime_;
        _lockTimer.epoch = epoch_;
        _lockTimer.enforce = true;

        _penalty.gracePeriod = gracePeriod_;
        _penalty.maxPerc = maxPenalty_;
        _penalty.minPerc = minPenalty_;
        _penalty.stepPerc = penaltyPerc_;

        paused = false;
    }
}