// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

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

        _gracePeriod = gracePeriod_; 
        _minLockTime = minLockTime_;
        _maxLockTime = maxLockTime_;
        _epoch = epoch_;
        
        _penaltyPerc = penaltyPerc_;
        _maxPenalty = maxPenalty_;
        _minPenalty = minPenalty_; 

        _enforceTime = true;
        paused = false;
    }
}