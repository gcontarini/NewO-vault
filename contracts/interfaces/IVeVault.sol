// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// Inheritance
import "./IERC4626.sol";

interface IVeVault is IERC4626 {
    function convertToShares(uint256 assets, uint256 lockTime) external pure returns(uint256 shares);
    function convertToAssets(uint256 shares, uint256 lockTime) external pure returns(uint256 assets);
    function previewDeposit(uint256 assets, uint256 lockTime) external pure returns(uint256 shares);
    function previewMint(uint256 shares, uint256 lockTime) external pure returns(uint256 assets);
    function previewWithdraw(uint256 assets, uint256 lockTime) external pure returns(uint256 shares);
    function previewRedeem(uint256 shares, uint256 lockTime) external pure returns(uint256 assets);
    function assetBalanceOf(address account) external view returns(uint256);
    function unlockDate(address account) external view returns(uint256);
    function gracePeriod() external view returns(uint256);
    function penaltyPercentage() external view returns(uint256);
    function minLockTime() external view returns(uint256);
    function maxLockTime() external view returns(uint256);
    function avgVeMult(address owner) external view returns(uint256);
    function deposit(uint256 assets, address receiver, uint256 lockTime) external returns (uint256 shares);
    function mint(uint256 shares, address receiver, uint256 lockTime) external returns(uint256 assets);
    function exit() external returns (uint256 shares);
    function recoverERC20(address tokenAddress, uint256 tokenAmount) external;

    event PayPenalty(address indexed caller, address indexed owner, uint256 assets);
    event Burn(address indexed user, uint256 shares);
    event Mint(address indexed user, uint256 shares);
    event Recovered(address token, uint256 amount);
}