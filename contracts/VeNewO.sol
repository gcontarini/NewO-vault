pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// Inheritance
import "./VeVault.sol";

contract VeNewO is VeVault {
    constructor(
        address owner_,
        address stakingToken_,
        uint256 bountyReward_,
        uint256 gracePeriod_,
        uint256 minLockTime_,
        uint256 maxLockTime_
    ) Owned(owner_) {
        // assetToken = IERC20(stakingToken_);
        _assetTokenAddress = stakingToken_;

        _penaltyPerc = bountyReward_;
        _gracePeriod = gracePeriod_; 
        _minLockTime = minLockTime_;
        _maxLockTime = maxLockTime_;

        _enforceTime = true;
        paused = false;
    }
}