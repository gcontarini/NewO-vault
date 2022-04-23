// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./Pausable.sol";
import "./RewardsDistributionRecipient.sol";

import "./interfaces/IUniswapV2Pair.sol";
import "./interfaces/IVeVault.sol";
import "./interfaces/IERC4626.sol";

// debugg
import "hardhat/console.sol";


abstract contract LpRewards is ReentrancyGuard, Pausable, RewardsDistributionRecipient, IERC4626 {
    using SafeERC20 for IERC20;
    
    /* ========= STATE VARIABLES ========= */

    // Reward token
    address public rewardsToken;
    
    // veNEWO vault
    address public veTokenVault;
    
    // Liquidity pool
    address public lp;

    // ASSET ==> address, total and balance per address (asset is the lp token)
    address public _assetTokenAddress;
    uint256 public _totalManagedAssets;
    mapping(address => uint256) public _assetBalances;

    // SHARES => total shares emitted by the vault and share per address
    uint256 private _totalSupply;
    mapping(address => uint256) public _shareBalances; 

    // ERC20 metadata (The share token)
    string public _name;
    string public _symbol;

    // Epochs
    uint256 public periodFinish = 0;
    uint256 public rewardRate = 0;
    uint256 public rewardsDuration = 7 days;
    uint256 public lastUpdateTime;

    // REWARDS ==> map liquidity token providers with respective reward and total rewards
    uint256 public totalRewards;
    mapping(address => uint256) public rewards;

    // Rewards already paied
    mapping(address => uint256) public userRewardPerTokenPaid;

    // Reward per token stored
    uint256 public rewardPerTokenStored;
    

    /* ============ CONSTRUCTOR ============== */

    constructor(string memory name_, string memory symbol_) {
        _name = name_;
        _symbol = symbol_;
    }

    /* ============ VIEWS (IERC4626) =================== */
    
    function asset() override external view returns (address assetTokenAddress) {
        return _assetTokenAddress;
    }
    
    function totalAssets() override external view returns (uint256 totalManagedAssets) {
        return _totalManagedAssets;
    }

    function totalSupply() override external view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) override external view returns (uint256) {
        return _shareBalances[account];
    }

    function assetBalanceOf(address account) external view returns (uint256) {
        return _assetBalances[account];
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
        return _assetBalances[owner];
    }

    function maxRedeem(address owner) override external view returns (uint256 maxShares) {
        if (paused) {
            return 0;
        }
        return _shareBalances[owner];
    }

    function convertToShares(uint256 assets) override external view returns (uint256 shares) {
        return assets * getMultiplier(msg.sender);
    }

    function convertToAssets(uint256 shares) override external view returns (uint256 assets) {
        return shares / getMultiplier(msg.sender);
    }

    function previewDeposit(uint256 assets) override external view returns (uint256 shares) {
        return assets * getMultiplier(msg.sender);
    }

    function previewMint(uint256 shares) override external view returns (uint256 assets) {
         return shares / getMultiplier(msg.sender);
    }

    function previewWithdraw(uint256 assets) override external view returns (uint256 shares) {
        return assets / getMultiplier(msg.sender);
    }

    function previewRedeem(uint256 shares) override external view returns (uint256 assets) {
        return shares / getMultiplier(msg.sender);
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
        revert("Transfer not allowed for this token.");
    }

    function approve(address, uint256) override external pure returns (bool) {
        revert("Approve not allowed for this token.");
    }

    function transferFrom(address, address, uint256) override external pure returns (bool) {
        revert("Transfer not allowed for this token.");
    }

    /* ============== REWARD FUNCTIONS ====================== */

    function lastTimeRewardApplicable() public view returns (uint256) {
        return block.timestamp < periodFinish ? block.timestamp : periodFinish;
    }

    function rewardPerToken() public view returns (uint256) {
        if (_totalSupply == 0) {
            return rewardPerTokenStored;
        }
        return
            rewardPerTokenStored
            + ((lastTimeRewardApplicable() - (lastUpdateTime))
                * (rewardRate) * (1e18)
                / (_totalSupply)
            );
    }
    
    function earned(address account) public view returns (uint256) {
        return rewards[account]
                + (_shareBalances[account]
                    * (rewardPerToken() - userRewardPerTokenPaid[account])
                    / (1e18));
    }

    function getRewardForDuration() external view returns (uint256) {
        return rewardRate * rewardsDuration;
    }

    function getReward() public nonReentrant updateReward(msg.sender) returns (uint256 reward) {
        reward = rewards[msg.sender];
        require(reward > 0, "No reward claimable");
            
        rewards[msg.sender] = 0;
        IERC20(rewardsToken).safeTransfer(msg.sender, reward);
        emit RewardPaid(msg.sender, reward);
        return reward;
    }

    function notifyRewardAmount(uint256 reward)
            override
            external
            onlyRewardsDistribution
            updateReward(address(0)) {
        if (block.timestamp >= periodFinish) {
            rewardRate = reward / rewardsDuration;
        } else {
            uint256 remaining = periodFinish - block.timestamp;
            uint256 leftover = remaining * rewardRate;
            rewardRate = (reward + leftover) / rewardsDuration;
        }

        // Ensure the provided reward amount is not more than the balance in the contract.
        // This keeps the reward rate in the right range, preventing overflows due to
        // very high values of rewardRate in the earned and rewardsPerToken functions;
        // Reward + leftover must be less than 2^256 / 10^18 to avoid overflow.
        uint balance = IERC20(rewardsToken).balanceOf(address(this));
        require(rewardRate <= balance / rewardsDuration, "Provided reward too high");

        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp + rewardsDuration;
        emit RewardAdded(reward);
    }

    function setRewardsDuration(uint256 _rewardsDuration) external onlyOwner {
        require(
            block.timestamp > periodFinish,
            "Previous rewards period must be complete before changing the duration for the new period"
        );
        rewardsDuration = _rewardsDuration;
        emit RewardsDurationUpdated(rewardsDuration);
    }

    /* =================  GET EXTERNAL INFO  =================== */

    // Get NEWO amount staked on the LP by caller
    function getNewoShare(address owner) public view returns (uint256) {
        uint112 reserve0; uint112 reserve1; uint32 timestamp;

        (reserve0, reserve1, timestamp) = IUniswapV2Pair(_assetTokenAddress).getReserves();
        return IUniswapV2Pair(_assetTokenAddress).balanceOf(owner)
                * reserve1
                / IUniswapV2Pair(_assetTokenAddress).totalSupply();
    }

    function getMultiplier(address owner) public view returns (uint256) {
        IVeVault veToken = IVeVault(veTokenVault);
        
        // to make sure that there is no division by zero
        uint256 _assetBalance = veToken.assetBalanceOf(owner);
        if(_assetBalance == 0){
            return 1;
        }else {
            return veToken.balanceOf(owner) / _assetBalance;   
        }
    }

    function getNewoLocked(address owner) public view returns (uint256) {
        return IVeVault(veTokenVault).assetBalanceOf(owner);
    }

    function avgMult(address owner) internal view returns (uint256) {
        return _shareBalances[owner] / _assetBalances[owner];
    }

    /* ========== MUTATIVE FUNCTIONS ========== */
    
    function deposit(uint256 assets, address receiver)
            override
            external
            nonReentrant
            notPaused
            updateReward(receiver)
            returns (uint256 shares) {
        // Grant boost
        shares = assets; 
        if(getNewoShare(receiver) >= getNewoLocked(receiver))
            shares *= getMultiplier(receiver);

        _deposit(assets, shares, receiver);
        return shares;
    }
    
    function mint(uint256 shares, address receiver)
            override
            external
            nonReentrant
            notPaused
            updateReward(receiver)
            returns (uint256 assets) {
        // Grant boost
        assets = shares;
        if(getNewoShare(receiver) >= getNewoLocked(receiver))
            assets /= getMultiplier(receiver);

        _deposit(assets, shares, receiver);
        return assets;
    }

    function withdraw(uint256 assets, address receiver, address owner)
            override
            external
            nonReentrant
            updateReward(owner)
            returns(uint256 shares) {
        shares = assets * avgMult(owner);
        _withdraw(assets, shares, receiver, owner);
        return shares; 
    }

    function redeem(uint256 shares, address receiver, address owner)
            override
            external 
            nonReentrant 
            updateReward(owner)
            returns (uint256 assets) {
        assets = shares / avgMult(owner);
        _withdraw(assets, shares, receiver, owner);
        return assets;
    }

    // Withdraw all to caller
    function exit() external nonReentrant updateReward(msg.sender) returns (uint256 reward) {
        _withdraw(_assetBalances[msg.sender], _shareBalances[msg.sender], msg.sender, msg.sender);
        return getReward();
    }

    /* ========== RESTRICTED FUNCTIONS ========== */
    
    function _withdraw(uint256 assets, uint256 shares, address receiver, address owner) internal {
        require(assets > 0, "Cannot withdraw 0");
        require(owner == msg.sender, "Caller must be the owner");
        require(_assetBalances[owner] >= assets, "Owner must have enought assets");
        
        // Remove LP Tokens (assets)
        _totalManagedAssets = _totalManagedAssets - assets;
        _assetBalances[owner] = _assetBalances[owner] - assets;
        
        // Remove shares
        _totalSupply = _totalSupply - shares;
        _shareBalances[owner] = _shareBalances[owner] - shares;

        IERC20(_assetTokenAddress).safeTransfer(receiver, assets);

        // ERC4626 compliance has to emit withdraw event
        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }
    
    function _deposit(uint256 assets, uint256 shares, address receiver) internal {
        require(assets > 0, "Cannot stake 0");
        require(receiver == msg.sender, "Receiver must be caller");

        // Lp tokens
        _totalManagedAssets += assets;
        _assetBalances[receiver] += assets;
        
        // Vault shares
        _totalSupply += shares;
        _shareBalances[receiver] += shares;

        IERC20(_assetTokenAddress).safeTransferFrom(msg.sender, address(this), assets);
        emit Deposit(msg.sender, address(this), assets, shares);
    }

    // Added to support recovering LP Rewards from other systems such as BAL to be distributed to holders
    function recoverERC20(address tokenAddress, uint256 tokenAmount) external onlyOwner {
        require(tokenAddress != address(_assetTokenAddress), "Cannot withdraw the staking token");
        IERC20(tokenAddress).safeTransfer(owner, tokenAmount);
        emit Recovered(tokenAddress, tokenAmount);
    }

    /* ========== MODIFIERS ========== */

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    /* ========== EVENTS ========== */

    event RewardAdded(uint256 reward);
    event RewardPaid(address indexed user, uint256 reward);
    event RewardsDurationUpdated(uint256 newDuration);
    event Recovered(address token, uint256 amount);
}