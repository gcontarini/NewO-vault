// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./Pausable.sol";
import "./RewardsDistributionRecipient.sol";
import "./interfaces/IUniswapV2Pair.sol";
import "./interfaces/IVeVault.sol";
import "./interfaces/IERC4626.sol";


abstract contract LpVault is ReentrancyGuard, Pausable, RewardsDistributionRecipient, IERC4626 {
    using SafeERC20 for IERC20;
    
    /* ========= STATE VARIABLES ========= */

    //The reward token
    address public rewardsToken;
    
    //Address of the veNEWO vault
    address public veTokenVault;
    
    // Address of the liquidity pool
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

    constructor(
        address _owner,
        address _lp,
        address _rewardsToken,
        address _veTokenVault,
        address _rewardsDistribution
    ) Owned (_owner) {
        _assetTokenAddress = _lp;
        rewardsToken = _rewardsToken;
        veTokenVault = _veTokenVault;
        rewardsDistribution = _rewardsDistribution;
    }

    /* ============ VIEWS =================== */

    /* ============ ERC4626 COMPLIANCE =================== */
    
    function asset() external view override returns(address assetTokenAddress) {
        return _assetTokenAddress;
    }
    
    function totalAssets() external view override returns(uint256 totalManagedAssets) {
        return _totalManagedAssets;
    }

    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view override returns (uint256) {
        return _shareBalances[account];
    }

    function assetBalanceOf(address account) external view returns(uint256) {
        return _assetBalances[account];
    }

    function maxDeposit(address) external pure override returns(uint256 maxAssets) {
        return 2 ** 256 - 1;
    }

    function maxMint(address) external pure override returns(uint256 maxShares) {
        return 2 ** 256 - 1;
    }

    function maxWithdraw(address owner) external view override returns(uint256 maxAssets) {
        if (paused) {
            return 0;
        }
        return _assetBalances[owner];
    }

    function maxRedeem(address owner) external view override returns(uint256 maxShares) {
        if (paused) {
            return 0;
        }
        return _shareBalances[owner];
    }

    function convertToShares(uint256 assets) external view override returns(uint256 shares) {
        return assets * getMultiplier();
    }

    function convertToAssets(uint256 shares) external view override returns(uint256 assets) {
        return shares / getMultiplier();
    }

    function previewDeposit(uint256 assets) external view override returns(uint256 shares) {
        return assets * getMultiplier();
    }

    function previewMint(uint256 shares) external view override returns(uint256 assets) {
         return shares / getMultiplier();
    }

    function previewWithdraw(uint256 assets) external view override returns(uint256 shares) {
        return assets / getMultiplier();
    }

    function previewRedeem(uint256 shares) external view override returns(uint256 assets) {
        return shares / getMultiplier();
    }

    /**
     * NEWOLpVault tokens are not transferable.
     * Always returns zero.
     */
    function allowance(address, address) external pure override returns (uint256) {
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

    function transfer(address, uint256) external pure override returns (bool) {
        revert("Transfer not allowed for this token.");
    }

    function approve(address, uint256) external pure override returns (bool) {
        revert("Approve not allowed for this token.");
    }

    function transferFrom(address, address, uint256) external pure override returns (bool) {
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
            rewardPerTokenStored+(
                (lastTimeRewardApplicable()-(lastUpdateTime))*(rewardRate)*(1e18)/(_totalSupply)
            );
    }
    
    function earned(address account) public view returns (uint256) {
        return (_shareBalances[account]*(rewardPerToken()-userRewardPerTokenPaid[account])/(1e18))+rewards[account];
    }

    function getRewardForDuration() external view returns (uint256) {
        return rewardRate*rewardsDuration;
    }


    /* =================  GET EXTERNAL INFO  =================== */

    // Get NEWO amount staked on the LP by caller
    function getNewoShare() public view returns (uint256) {
        uint112 reserve0;
        uint112 reserve1;
        uint32 timestamp;
        (reserve0, reserve1, timestamp) = IUniswapV2Pair(_assetTokenAddress).getReserves();
        return IUniswapV2Pair(_assetTokenAddress).balanceOf(msg.sender)*reserve1/IUniswapV2Pair(_assetTokenAddress).totalSupply();
    }

    function getMultiplier() public view returns(uint256) {
        return IVeVault(veTokenVault).avgVeMult(msg.sender);
    }

    function getNewoLocked() public view returns(uint256) {
        return IVeVault(veTokenVault).assetBalanceOf(msg.sender);
    }

    /* ========== MUTATIVE FUNCTIONS ========== */
    
    function deposit(uint256 assets, address receiver) override external nonReentrant notPaused updateReward(msg.sender) returns (uint256 shares) {
        require(assets > 0, "Cannot stake 0");
        require(receiver == msg.sender, "Receiver must be caller");

        // IF MSG.SENDER CAN GET THE BONUS
        uint256 bonusMultiplier = 1;
        if(getNewoShare() >= getNewoLocked())
            bonusMultiplier = getMultiplier();
        
        // ADD LP TOKENS BY AMOUNT
        _totalManagedAssets = _totalManagedAssets + assets;
        _assetBalances[receiver] = _assetBalances[receiver] + assets;
        
        // ADD SHARES BY AMOUNT * MULTIPLIER
        _totalSupply = _totalSupply + assets * bonusMultiplier;
        _shareBalances[receiver] = _shareBalances[receiver] + assets * bonusMultiplier;

        IERC20(_assetTokenAddress).safeTransferFrom(receiver, address(this), assets);

        // ERC4626 compliance has to emit deposit event
        emit Deposit(msg.sender, address(this), assets, (assets * bonusMultiplier));

        // ERC4626 compliance. It has to return shares minted
        return assets * bonusMultiplier;
    }

    function withdraw(uint256 assets, address receiver, address owner) override public nonReentrant updateReward(msg.sender) returns(uint256 shares){
        require(assets > 0, "Cannot withdraw 0");
        require(owner == msg.sender, "Caller must be the owner");
        require(assets <= _assetBalances[owner], "Owner must have enought assets");
        
        shares = assets;
        if(getNewoShare() >= getNewoLocked())
            shares *= getMultiplier();
        
        // Remove LP Tokens (assets)
        _totalManagedAssets = _totalManagedAssets - assets;
        _assetBalances[owner] = _assetBalances[owner] - assets;
        
        // Remove shares
        _totalSupply = _totalSupply - shares;
        _shareBalances[owner] = _shareBalances[owner] - shares;

        IERC20(_assetTokenAddress).safeTransfer(receiver, assets);

        // ERC4626 compliance has to emit withdraw event (does this arguments make any sense?)
        emit Withdraw(msg.sender, receiver, owner, assets, shares);

        // ERC4626 compliance. It has to return shares burned
        return shares;
    }

    function getReward() public nonReentrant updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            IERC20(rewardsToken).safeTransfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    function exit() external {
        withdraw(_assetBalances[msg.sender], msg.sender, msg.sender);
        getReward();
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    function notifyRewardAmount(uint256 reward) external override onlyRewardsDistribution updateReward(address(0)) {
        if (block.timestamp >= periodFinish) {
            rewardRate = reward/rewardsDuration;
        } else {
            uint256 remaining = periodFinish-block.timestamp;
            uint256 leftover = remaining*rewardRate;
            rewardRate = (reward+leftover)/rewardsDuration;
        }

        // Ensure the provided reward amount is not more than the balance in the contract.
        // This keeps the reward rate in the right range, preventing overflows due to
        // very high values of rewardRate in the earned and rewardsPerToken functions;
        // Reward + leftover must be less than 2^256 / 10^18 to avoid overflow.
        uint balance = IERC20(rewardsToken).balanceOf(address(this));
        require(rewardRate <= balance/rewardsDuration, "Provided reward too high");

        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp+rewardsDuration;
        emit RewardAdded(reward);
    }

    // Added to support recovering LP Rewards from other systems such as BAL to be distributed to holders
    function recoverERC20(address tokenAddress, uint256 tokenAmount) external onlyOwner {
        require(tokenAddress != address(_assetTokenAddress), "Cannot withdraw the staking token");
        IERC20(tokenAddress).safeTransfer(owner, tokenAmount);
        emit Recovered(tokenAddress, tokenAmount);
    }

    function setRewardsDuration(uint256 _rewardsDuration) external onlyOwner {
        require(
            block.timestamp > periodFinish,
            "Previous rewards period must be complete before changing the duration for the new period"
        );
        rewardsDuration = _rewardsDuration;
        emit RewardsDurationUpdated(rewardsDuration);
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
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    event RewardsDurationUpdated(uint256 newDuration);
    event Recovered(address token, uint256 amount);
}