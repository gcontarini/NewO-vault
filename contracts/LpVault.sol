// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";


import "./Pausable.sol";
import "./RewardsDistributionRecipient.sol";
import "./interfaces/IUniswapV2Pair.sol";
import "./interfaces/IVeVault.sol";


contract LpVault is ReentrancyGuard, Pausable, RewardsDistributionRecipient{
    using SafeERC20 for IERC20;
    
    /* ========= STATE VARIABLES ========= */

    //NEWO token interface
    IERC20 public rewardsToken;

    // The lpToken (staking token);
    IERC20 public lpToken;
    
    //Address of the veNEWO vault (or should it be the address of the veToken?)
    address public veTokenVault;
    
    // Address of the liquidity pool (NEWO:AVAX or NEWO:MATIC)
    address public lp;
    
    // Epochs
    uint256 public periodFinish = 0;
    uint256 public rewardRate = 0;
    uint256 public rewardsDuration = 7 days;
    uint256 public lastUpdateTime;
    
    // total rewards available to distribute
    uint256 public totalRewards;
    
    //total Lp staked on the vault
    uint256 private _totalSupply;

    // map liquidity token providers with respective reward
    mapping(address => uint256) public rewards;

    // map liquidity token providers with respective lp staked
    mapping(address => uint256) private _balances; 

    // Rewards already paied
    mapping(address => uint256) public userRewardPerTokenPaid;

    // Reward per token stored TODO: Maybe rewards per token stored should be a mapped by user. Each user will have a differente rewardPerToken
    uint256 public rewardPerTokenStored;
    

    /* ============ CONSTRUCTOR ============== */

    constructor(
        address _owner,
        address _lp,
        address _rewardsToken,
        address _veTokenVault,
        address _rewardsDistribution
    ) Owned (_owner) {
        lp = _lp;
        lpToken = IERC20(_lp);
        rewardsToken = IERC20(_rewardsToken);
        veTokenVault = _veTokenVault;
        rewardsDistribution = _rewardsDistribution;
    }

    /* ============ VIEWS =================== */

    function totalSupply() external view returns (uint256){
        return _totalSupply;
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

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
        return (_balances[account]*(rewardPerToken()-userRewardPerTokenPaid[account])/(1e18))+rewards[account];
    }

    function getRewardForDuration() external view returns (uint256) {
        return rewardRate*rewardsDuration;
    }

    // get newo amount hold by the user on the pool
    function getNewoShare() public view returns (uint256) {
        uint112 reserve0;
        uint112 reserve1;
        uint32 timestamp;
        (reserve0, reserve1, timestamp) = IUniswapV2Pair(lp).getReserves();
        return IUniswapV2Pair(lp).balanceOf(msg.sender)*reserve1/IUniswapV2Pair(lp).totalSupply();
    }

    function getMultiplier() public view returns(uint256) {
        return IVeVault(veTokenVault).avgVeMult(msg.sender);
    }

    function getNewoLocked() public view returns(uint256) {
        return IVeVault(veTokenVault).assetBalanceOf(msg.sender);
    }
    /* ========== MUTATIVE FUNCTIONS ========== */

    
    // TODO: IF USER CAN HAVE THE BONUS, IT MAYBE A GOOD IDEA TO JUST ADD MORE TOKENS TO HIS BALANCE IN THE AMOUNT OF THE MULTIPLIER
    
    function stake(uint256 amount) external nonReentrant notPaused updateReward(msg.sender) {
        require(amount > 0, "Cannot stake 0");
        if(getNewoShare() >= getNewoLocked()) {
            _totalSupply = _totalSupply + amount * getMultiplier();
            _balances[msg.sender] = _balances[msg.sender] + amount * getMultiplier();
            lpToken.safeTransferFrom(msg.sender, address(this), amount);
            emit Staked(msg.sender, amount);
        }
        else {
            _totalSupply = _totalSupply+amount;
            _balances[msg.sender] = _balances[msg.sender]+amount;
            lpToken.safeTransferFrom(msg.sender, address(this), amount);
            emit Staked(msg.sender, amount);
        }
    }

    function withdraw(uint256 amount) public nonReentrant updateReward(msg.sender) {
        require(amount > 0, "Cannot withdraw 0");
        _totalSupply = _totalSupply-amount;
        _balances[msg.sender] = _balances[msg.sender]-amount;
        lpToken.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function getReward() public nonReentrant updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            rewardsToken.safeTransfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    function exit() external {
        withdraw(_balances[msg.sender]);
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
        uint balance = rewardsToken.balanceOf(address(this));
        require(rewardRate <= balance/rewardsDuration, "Provided reward too high");

        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp+rewardsDuration;
        emit RewardAdded(reward);
    }

    // Added to support recovering LP Rewards from other systems such as BAL to be distributed to holders
    function recoverERC20(address tokenAddress, uint256 tokenAmount) external onlyOwner {
        require(tokenAddress != address(lpToken), "Cannot withdraw the staking token");
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