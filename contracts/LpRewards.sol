// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import "./Pausable.sol";
import "./RewardsDistributionRecipient.sol";

import "./interfaces/IUniswapV2Pair.sol";
import "./interfaces/IVeVault.sol";
import "./interfaces/IERC4626.sol";

// Custom errors
error Unauthorized();
error UnauthorizedClaim();
error NotImplemented();
error RewardTooHigh(uint256 allowed, uint256 reward);
error NotWhitelisted();
error InsufficientBalance();

/** 
 * @title Implements a reward system which grants rewards based on LP
 * staked in this contract and grants boots based on depositor veToken balance
 * @author gcontarini jocorrei
 * @dev This implementation tries to follow the ERC4626 standard
 * Implement a new constructor to deploy this contract 
 */
abstract contract LpRewards is ReentrancyGuard, Pausable, RewardsDistributionRecipient, IERC4626 {
    using SafeERC20 for IERC20;

    struct Account {
        uint256 rewards;
        uint256 assets;
        uint256 shares;
        uint256 sharesBoost;
        uint256 rewardPerTokenPaid;
    }

    struct Total {
        uint256 managedAssets;
        uint256 supply;
    }
    
    /* ========= STATE VARIABLES ========= */

    // veVault
    address public veVault;
    // Reward token
    address public rewardsToken;
    // Asset token (LP token)
    address public assetToken;

    // Contract totals
    Total public total;
    // User info
    mapping(address => Account) internal accounts;

    // Reward per token
    uint256 public rewardPerTokenStored;
    uint256 public rewardRate = 0;

    // Epochs
    uint256 public periodFinish = 0;
    uint256 public rewardsDuration = 7 days;
    uint256 public lastUpdateTime;

    // Math precision
    uint256 internal constant PRECISION = 1e18; 
    
    // ERC20 metadata (The share token)
    string public _name;
    string public _symbol;

    // Only allow recoverERC20 from this list
    mapping(address => bool) public whitelistRecoverERC20;

    /* ============ CONSTRUCTOR ============== */

    constructor(string memory name_, string memory symbol_) {
        _name = name_;
        _symbol = symbol_;
    }

    /* ============ VIEWS (IERC4626) =================== */
    
    /**
     * @notice address of asset token
     */
    function asset() override external view returns (address assetTokenAddress) {
        return assetToken;
    }
    
    function totalAssets() override external view returns (uint256 totalManagedAssets) {
        return total.managedAssets;
    }

    function totalSupply() override external view returns (uint256) {
        return total.supply;
    }

    function balanceOf(address owner) override external view returns (uint256) {
        return accounts[owner].shares;
    }

    function assetBalanceOf(address owner) external view returns (uint256) {
        return accounts[owner].assets;
    }

    function maxDeposit(address) override external pure returns (uint256 maxAssets) {
        return 2 ** 256 - 1;
    }

    function maxMint(address) override external pure returns (uint256 maxShares) {
        return 2 ** 256 - 1;
    }

    function maxWithdraw(address owner) override external view returns (uint256 maxAssets) {
        if (paused) {
            return 0;
        }
        return accounts[owner].assets;
    }

    function maxRedeem(address owner) override external view returns (uint256 maxShares) {
        if (paused) {
            return 0;
        }
        // Since assets and (shares - sharesBoost) have an 1:1 ratio
        return accounts[owner].assets;
    }

    function convertToShares(uint256 assets) override external view returns (uint256 shares) {
        return assets * getMultiplier(msg.sender) / PRECISION;
    }

    function convertToAssets(uint256 shares) override external view returns (uint256 assets) {
        return shares * PRECISION / getMultiplier(msg.sender);
    }

    function previewDeposit(uint256 assets) override external view returns (uint256 shares) {
        return assets * getMultiplier(msg.sender) / PRECISION;
    }

    function previewMint(uint256 shares) override external view returns (uint256 assets) {
         return shares * PRECISION / getMultiplier(msg.sender);
    }

    function previewWithdraw(uint256 assets) override external view returns (uint256 shares) {
        return assets * getMultiplier(msg.sender) / PRECISION;
    }

    function previewRedeem(uint256 shares) override external view returns (uint256 assets) {
        return shares * PRECISION / getMultiplier(msg.sender);
    }

    /**
     * xNEWO tokens are not transferable.
     * Always returns zero.
     */
    function allowance(address, address) override external pure returns (uint256) {
        return 0;
    }

    /**
     * @dev Returns the name, symbol and decimals of the token.
     */
    function name() public view virtual returns (string memory) {
        return _name;
    }

    function symbol() public view virtual returns (string memory) {
        return _symbol;
    }

    function decimals() public view virtual returns (uint8) {
        return 18;
    }

     /* ========== ERC20 NOT ALLOWED FUNCTIONS ========== */

    function transfer(address, uint256) override external pure returns (bool) {
        revert Unauthorized();
    }

    function approve(address, uint256) override external pure returns (bool) {
        revert Unauthorized();
    }

    function transferFrom(address, address, uint256) override external pure returns (bool) {
        revert Unauthorized();
    }

    /* ============== REWARD FUNCTIONS ====================== */

    function lastTimeRewardApplicable() public view returns (uint256) {
        return block.timestamp < periodFinish ? block.timestamp : periodFinish;
    }

    function rewardPerToken() public view returns (uint256) {
        if (total.supply == 0) {
            return rewardPerTokenStored;
        }
        return
            rewardPerTokenStored
            + ((lastTimeRewardApplicable() - lastUpdateTime)
                * rewardRate
                * PRECISION 
                / total.supply
            );
    }
    
    function earned(address owner) public view returns (uint256) {
        return accounts[owner].rewards
                + (accounts[owner].shares
                    * (rewardPerToken() - accounts[owner].rewardPerTokenPaid)
                    / PRECISION);
    }

    function getRewardForDuration() external view returns (uint256) {
        return rewardRate * rewardsDuration;
    }

    function getReward() public updateReward(msg.sender) returns (uint256 reward) {
        reward = accounts[msg.sender].rewards;
        if(reward <= 0)
            revert UnauthorizedClaim();
        accounts[msg.sender].rewards = 0;
        IERC20(rewardsToken).safeTransfer(msg.sender, reward);
        emit RewardPaid(msg.sender, reward);
        return reward;
    }

    function notifyRewardAmount(uint256 reward)
            override
            external
            onlyRewardsDistribution
            updateReward(address(0)) {
        if (block.timestamp >= periodFinish)
            rewardRate = reward / rewardsDuration;
        else {
            uint256 remaining = periodFinish - block.timestamp;
            uint256 leftover = remaining * rewardRate;
            rewardRate = (reward + leftover) / rewardsDuration;
        }

        // Ensure the provided reward amount is not more than the balance in the contract.
        // This keeps the reward rate in the right range, preventing overflows due to
        // very high values of rewardRate in the earned and rewardsPerToken functions;
        // Reward + leftover must be less than 2^256 / 10^18 to avoid overflow.
        uint balance = IERC20(rewardsToken).balanceOf(address(this));
        if(rewardRate > balance / rewardsDuration)
            revert RewardTooHigh({
                allowed: balance,
                reward: reward
            });
        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp + rewardsDuration;
        emit RewardAdded(reward);
    }

    function setRewardsDuration(uint256 _rewardsDuration) external onlyOwner {
        if (block.timestamp <= periodFinish)
            revert Unauthorized();
        rewardsDuration = _rewardsDuration;
        emit RewardsDurationUpdated(rewardsDuration);
    }

    /* =================  GET EXTERNAL INFO  =================== */

    // Get NEWO amount staked on the LP by caller
    function getNewoShare(address owner) public view returns (uint256) {
        uint112 reserve0; uint112 reserve1; uint32 timestamp;

        (reserve0, reserve1, timestamp) = IUniswapV2Pair(assetToken).getReserves();
        return accounts[owner].assets * reserve0
                / IUniswapV2Pair(assetToken).totalSupply();
    }

    function getMultiplier(address owner) public view returns (uint256) {
        IVeVault veToken = IVeVault(veVault);
        uint256 assetBalance = veToken.assetBalanceOf(owner);
        
        // to make sure that there is no division by zero
        if (assetBalance == 0)
            return 1;
        return veToken.balanceOf(owner) * PRECISION / assetBalance;   
    }

    function getNewoLocked(address owner) public view returns (uint256) {
        return IVeVault(veVault).assetBalanceOf(owner);
    }

    /* ========== MUTATIVE FUNCTIONS ========== */
    
    function deposit(uint256 assets, address receiver)
            override
            external
            nonReentrant
            notPaused
            updateReward(receiver)
            updateBoost(receiver)
            returns (uint256 shares) {
        shares = assets;
        _deposit(assets, shares, receiver);
        return shares;
    }

    function mint(uint256, address)
            override
            external
            pure
            returns (uint256) {
        revert NotImplemented();
    }

    function withdraw(uint256 assets, address receiver, address owner)
            override
            external
            nonReentrant
            updateReward(owner)
            updateBoost(owner)
            returns(uint256 shares) {
        shares = assets;
        _withdraw(assets, shares, receiver, owner);
        return shares; 
    }

    function redeem(uint256, address, address)
            override
            external 
            pure
            returns (uint256) {
        revert NotImplemented();
    }

    // Withdraw all to caller
    function exit() external
            nonReentrant 
            updateReward(msg.sender)
            updateBoost(msg.sender)
            returns (uint256 reward) {
        _withdraw(accounts[msg.sender].assets, accounts[msg.sender].shares - accounts[msg.sender].sharesBoost, msg.sender, msg.sender);
        reward = getReward();
        return reward;
    }

    /* ========== RESTRICTED FUNCTIONS ========== */
    
    function _withdraw(uint256 assets, uint256 shares, address receiver, address owner) internal {
        if(assets <= 0 || owner != msg.sender 
            || accounts[owner].assets < assets
            || (accounts[owner].shares - accounts[owner].sharesBoost) < shares)
            revert Unauthorized();
    
        // Remove LP Tokens (assets)
        total.managedAssets -= assets;
        accounts[owner].assets -= assets;
        
        // Remove shares
        total.supply -= shares;
        accounts[owner].shares -= shares;

        IERC20(assetToken).safeTransfer(receiver, assets);

        // ERC4626 compliance has to emit withdraw event
        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }
    
    function _deposit(uint256 assets, uint256 shares, address receiver) internal {
        if(assets <= 0 || receiver != msg.sender)
            revert Unauthorized();
        // Lp tokens
        total.managedAssets += assets;
        accounts[receiver].assets += assets;

        // Vault shares
        total.supply += shares;
        accounts[receiver].shares += shares;

        IERC20(assetToken).safeTransferFrom(msg.sender, address(this), assets);
        emit Deposit(msg.sender, address(this), assets, shares);
    }

    function changeWhitelistRecoverERC20(address tokenAddress, bool flag) external onlyOwner {
        whitelistRecoverERC20[tokenAddress] = flag;
        emit ChangeWhitelistERC20(tokenAddress, flag);
    }

    // Added to support recovering LP Rewards from other systems such as BAL to be distributed to holders
    function recoverERC20(address tokenAddress, uint256 tokenAmount) external onlyOwner {
        if (whitelistRecoverERC20[tokenAddress] == false) revert NotWhitelisted();
        
        uint balance = IERC20(tokenAddress).balanceOf(address(this));
        if (balance < tokenAmount) revert InsufficientBalance(); 

        IERC20(tokenAddress).safeTransfer(owner, tokenAmount);
        emit Recovered(tokenAddress, tokenAmount);
    }

    function recoverERC721(address tokenAddress, uint256 tokenId) external onlyOwner {
        IERC721(tokenAddress).safeTransferFrom(address(this), owner, tokenId);
        emit RecoveredNFT(tokenAddress, tokenId);
    }
    
    /* ========== MODIFIERS ========== */

    modifier updateReward(address owner) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        if (owner != address(0)) {
            accounts[owner].rewards = earned(owner);
            accounts[owner].rewardPerTokenPaid = rewardPerTokenStored;
        }
        _;
    }

    modifier updateBoost(address owner) {
        _;
        uint256 oldShares = accounts[owner].shares;
        uint256 newShares = oldShares;
        if (getNewoShare(owner) <= getNewoLocked(owner)){
            newShares = accounts[owner].assets * getMultiplier(owner) / PRECISION;
        }
        if (newShares > oldShares) {
            // Mint boost shares
            uint256 diff = newShares - oldShares;
            total.supply += diff;
            accounts[owner].sharesBoost = diff;
            accounts[owner].shares = newShares;
            emit BoostUpdated(owner, accounts[owner].shares, accounts[owner].sharesBoost);
        } else if (newShares < oldShares) {
            // Burn boost shares
            uint256 diff = oldShares - newShares;
            total.supply -= diff;
            accounts[owner].sharesBoost = diff;
            accounts[owner].shares = newShares;
            emit BoostUpdated(owner, accounts[owner].shares, accounts[owner].sharesBoost);
        }
    }

    /* ========== EVENTS ========== */

    event RewardAdded(uint256 reward);
    event RewardPaid(address indexed user, uint256 reward);
    event RewardsDurationUpdated(uint256 newDuration);
    event Recovered(address token, uint256 amount);
    event RecoveredNFT(address tokenAddress, uint256 tokenId);
    event ChangeWhitelistERC20(address indexed tokenAddress, bool whitelistState);
    event BoostUpdated(address indexed owner, uint256 totalShares, uint256 boostShares);
}