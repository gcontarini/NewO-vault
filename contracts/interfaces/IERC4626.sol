// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "@openzeppelin/contracts/interfaces/IERC20.sol";

interface IERC4626 is IERC20 {
    // The address of the underlying token used for the Vault for accounting, depositing, and withdrawing.
    function asset() external view returns(address assetTokenAddress);

    // Total amount of the underlying asset that is “managed” by Vault.
    function totalAssets() external view returns(uint256 totalManagedAssets);

    // The amount of shares that the Vault would exchange for the amount of assets provided, in an ideal scenario where all the conditions are met.
    function convertToShares(uint256 assets) external view returns(uint256 shares);

    // The amount of assets that the Vault would exchange for the amount of shares provided, in an ideal scenario where all the conditions are met.
    function convertToAssets(uint256 shares) external view returns(uint256 assets);

    // Maximum amount of the underlying asset that can be deposited into the Vault for the receiver, through a deposit call.
    function maxDeposit(address receiver) external view returns(uint256 maxAssets);

    // Allows an on-chain or off-chain user to simulate the effects of their deposit at the current block, given current on-chain conditions.
    function previewDeposit(uint256 assets) external view returns(uint256 shares);

    // Mints shares Vault shares to receiver by depositing exactly amount of underlying tokens.
    function deposit(uint256 assets, address receiver) external returns(uint256 shares);

    // Maximum amount of shares that can be minted from the Vault for the receiver, through a mint call.
    function maxMint(address receiver) external view returns(uint256 maxShares);

    // Allows an on-chain or off-chain user to simulate the effects of their mint at the current block, given current on-chain conditions.
    function previewMint(uint256 shares) external view returns(uint256 assets);

    // Mints exactly shares Vault shares to receiver by depositing amount of underlying tokens.
    function mint(uint256 shares, address receiver) external returns(uint256 assets);

    // Maximum amount of the underlying asset that can be withdrawn from the owner balance in the Vault, through a withdraw call.
    function maxWithdraw(address owner) external view returns(uint256 maxAssets);

    // Allows an on-chain or off-chain user to simulate the effects of their withdrawal at the current block, given current on-chain conditions.
    function previewWithdraw(uint256 assets) external view returns(uint256 shares);

    // Burns shares from owner and sends exactly assets of underlying tokens to receiver.
    function withdraw(uint256 assets, address receiver, address owner) external returns(uint256 shares);

    // Maximum amount of Vault shares that can be redeemed from the owner balance in the Vault, through a redeem call.
    function maxRedeem(address owner) external view returns(uint256 maxShares);

    // Allows an on-chain or off-chain user to simulate the effects of their redeemption at the current block, given current on-chain conditions.
    function previewRedeem(uint256 shares) external view returns(uint256 assets);

    // Burns exactly shares from owner and sends assets of underlying tokens to receiver.
    function redeem(uint256 shares, address receiver, address owner) external returns(uint256 assets);

    event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares);
    event Withdraw(address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares);
}