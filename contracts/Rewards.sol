pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// Inheritance
import "./RewardsDistributionRecipient.sol";
import "./Pausable.sol";

contract Rewards is RewardsDistributionRecipient, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    /* ========== STATE VARIABLES ========== */

    IERC20 public rewardsToken;
    // TODO implement vault as interface
    address public vault;                    //address of the ve vault
    uint256 public periodFinish = 0;         //end of the rewardDuration period
    uint256 public rewardRate = 0;           //Rewards per second distributed by the contract ==> rewardavailable / rewardDuration
    uint256 public rewardsDuration = 7 days; //the rewards inside the contract are gone be distributed during this period
    uint256 public lastUpdateTime;           //when the reward period started
    uint256 public rewardPerTokenStored;     //amounts of reward per staked token

    mapping(address => uint256) public userRewardPerTokenPaid;  //rewardPerTokenStored last update
    mapping(address => uint256) public rewards; //earned() last update

    /* ========== CONSTRUCTOR ========== */

    constructor(
        address _owner,
        address _vault,
        address _rewardsDistribution,
        address _rewardsToken
    ) Owned(_owner) {
        rewardsToken = IERC20(_rewardsToken);
        rewardsDistribution = _rewardsDistribution;
        vault = _vault;
    }

    /* ========== VIEWS ========== */

    function getVault() public view returns (address) {
        return vault;
    }

    function lastTimeRewardApplicable() public view returns (uint256) {
        return block.timestamp < periodFinish ? block.timestamp : periodFinish;
    }

    function rewardPerToken() public view returns (uint256) {
        // Check the total supply of vault, not an ERC20
        uint256 _totalSupply = IERC20(vault).totalSupply();

        if (_totalSupply == 0) {
            return rewardPerTokenStored;
        }
        return
            rewardPerTokenStored + (
                (lastTimeRewardApplicable()-(lastUpdateTime))*(rewardRate)*(1e18)/(_totalSupply)
            );
    }
    
    // This function calculates how much rewards a staker earned and there for will get when calling getReward()
    function earned(address account) public view returns (uint256) {
        // Again, vault is not an ERC20 but implement this interface 
        return (IERC20(vault).balanceOf(account) * (rewardPerToken() - userRewardPerTokenPaid[account]) / (1e18)) + rewards[account];
    }

    function getRewardForDuration() external view returns (uint256) {
        return rewardRate * rewardsDuration;
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function getReward() public nonReentrant updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            rewardsToken.safeTransfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    function notifyRewardAmount(uint256 reward) external override onlyRewardsDistribution updateReward(address(0)) {
        if (block.timestamp >= periodFinish) {
            rewardRate = reward/rewardsDuration;
        } else {
            uint256 remaining = periodFinish - block.timestamp;
            uint256 leftover = remaining * rewardRate;
            rewardRate = (reward + leftover) / rewardsDuration;
        }

        // Ensure the provided reward amount is not more than the balance in the contract.
        // This keeps the reward rate in the right range, preventing overflows due to
        // very high values of rewardRate in the earned and rewardsPerToken functions;
        // Reward + leftover must be less than 2^256 / 10^18 to avoid overflow.
        uint balance = rewardsToken.balanceOf(vault);
        require(rewardRate <= balance / rewardsDuration, "Provided reward too high");

        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp+rewardsDuration;
        emit RewardAdded(reward);
    }

    // Ask marek about this function
    function recoverERC20(address tokenAddress, uint256 tokenAmount) external onlyOwner {
        // Not correct, we need the addres of the staking token allowed in the vault
        require(tokenAddress != vault, "Cannot withdraw the staking token");
        IERC20(tokenAddress).safeTransfer(owner, tokenAmount);
        emit Recovered(tokenAddress, tokenAmount);
    }

    function setRewardsDuration(uint256 _rewardsDuration) external onlyOwner {
        require(
            block.timestamp > periodFinish,
            "Previous rewards period must be complete"
        );
        rewardsDuration = _rewardsDuration;
        emit RewardsDurationUpdated(rewardsDuration);
    }
    
    
    function superUpdateReward(address account) external {
        require(msg.sender == vault, "The caller is not the vault"); ///???????
        rewardPerTokenStored = rewardPerToken(); 
        lastUpdateTime = lastTimeRewardApplicable();
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
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
    // event Staked(address indexed user, uint256 amount);
    // event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    event RewardsDurationUpdated(uint256 newDuration);
    event Recovered(address token, uint256 amount);
}