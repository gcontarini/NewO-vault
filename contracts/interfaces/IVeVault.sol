// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

// Inheritance
import "./IERC4626.sol";

interface IVeVault is IERC4626 {
    function asset() external view  returns (address assetTokenAddress);
    function totalAssets() external view  returns (uint256 totalManagedAssets);
    function totalSupply() external view  returns (uint256);
    function balanceOf(address account) external view  returns (uint256);
    function convertToShares(uint256 assets, uint256 lockTime) external view returns (uint256 shares);
    function convertToShares(uint256 assets)  external view returns (uint256 shares);
    function convertToAssets(uint256 shares, uint256 lockTime) external view returns (uint256 assets);
    function convertToAssets(uint256 shares)  external view returns (uint256 assets);
    function maxDeposit(address)  external pure returns (uint256 maxAssets);
    function previewDeposit(uint256 assets, uint256 lockTime) external view returns (uint256 shares);
    function previewDeposit(uint256 assets)  external view returns (uint256 shares);
    function maxMint(address)  external pure returns (uint256 maxShares);
    function previewMint(uint256 shares, uint256 lockTime) external view returns (uint256 assets);
    function previewMint(uint256 shares)  external view returns (uint256 assets);
    function maxWithdraw(address owner)  external view returns (uint256 maxAssets);
    function previewWithdraw(uint256 assets, uint256 lockTime) external view returns (uint256 shares);
    function previewWithdraw(uint256 assets)  external view returns (uint256 shares);
    function maxRedeem(address owner)  external view returns (uint256 maxShares);
    function previewRedeem(uint256 shares, uint256 lockTime) external view returns (uint256 assets);
    function previewRedeem(uint256 shares)  external view returns (uint256 assets);
    function allowance(address, address)  external view returns (uint256);
    function assetBalanceOf(address account) external view returns (uint256);
    function unlockDate(address account) external view returns (uint256);
    function gracePeriod() external view returns (uint256);
    function penaltyPercentage() external view returns (uint256);
    function minLockTime() external view returns (uint256);
    function maxLockTime() external view returns (uint256);
    function transfer(address, uint256) external  returns (bool);
    function approve(address, uint256) external  returns (bool);
    function transferFrom(address, address, uint256) external  returns (bool);
    function veMult(address owner) external view returns (uint256);
    function deposit(uint256 assets, address receiver, uint256 lockTime) external returns (uint256 shares);
    function deposit(uint256 assets, address receiver)  external returns (uint256 shares);
    function mint(uint256 shares, address receiver, uint256 lockTime) external returns (uint256 assets);
    function mint(uint256 shares, address receiver)  external returns (uint256 assets);
    function withdraw(uint256 assets, address receiver, address owner)  external returns (uint256 shares);
    function redeem(uint256 shares, address receiver, address owner)  external returns (uint256 assets);
    function exit() external returns (uint256 shares);
    function changeUnlockRule(bool flag) external;
    function changeGracePeriod(uint256 newGracePeriod) external;
    function changeEpoch(uint256 newEpoch) external;
    function changeMinPenalty(uint256 newMinPenalty) external;
    function changeMaxPenalty(uint256 newMaxPenalty) external;
    function changeWhitelistRecoverERC20(address tokenAddress, bool flag) external;
    function recoverERC20(address tokenAddress, uint256 tokenAmount) external;
    function recoverERC721(address tokenAddress, uint256 tokenId) external;

    event PayPenalty(address indexed caller, address indexed owner, uint256 assets);
    event Burn(address indexed user, uint256 shares);
    event Mint(address indexed user, uint256 shares);
    event Recovered(address token, uint256 amount);
    event RecoveredNFT(address tokenAddress, uint256 tokenId);
    event ChangeWhitelistERC20(address indexed tokenAddress, bool whitelistState);
}