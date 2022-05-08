// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/IVeVault.sol";

// Inheritance
import "./RewardsDistributionRecipient.sol";
import "./Pausable.sol";

error RewardTooHigh();
error RewardPeriodNotComplete(uint256 finish);

contract Rewards is RewardsDistributionRecipient, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    struct Account {
        uint256 rewardPerTokenPaid;
        uint256 rewards;
        uint256 dueDate;
    }

    /* ========== STATE VARIABLES ========== */

    address public rewardsToken;
    address public vault;                    // address of the ve vault
    uint256 public periodFinish = 0;         // end of the rewardDuration period
    uint256 public rewardRate = 0;           // rewards per second distributed by the contract ==> rewardavailable / rewardDuration
    uint256 public rewardsDuration = 7 days; // the rewards inside the contract are gone be distributed during this period
    uint256 public lastUpdateTime;           // when the reward period started
    uint256 public rewardPerTokenStored;     // amounts of reward per staked token

    mapping(address => Account) public accounts;

    /* ========== CONSTRUCTOR ========== */

    constructor(
        address _owner,
        address _vault,
        address _rewardsDistribution,
        address _rewardsToken
    ) Owned(_owner) {
        rewardsToken = _rewardsToken;
        rewardsDistribution = _rewardsDistribution;
        vault = _vault;
        lastUpdateTime = block.timestamp;
    }

    /* ========== VIEWS ========== */

    function getVaultAddress() public view returns (address) {
        return vault;
    }

    /**
     * Pick the correct date for applying the reward
     * Apply until the end of periodFinish or until
     * unlockDate for funds in the veVault
     */
    function lastTimeRewardApplicable(address owner) public view returns (uint256) {
        if (owner != address(0) && accounts[owner].dueDate < periodFinish) {
            return block.timestamp < accounts[owner].dueDate ? block.timestamp : accounts[owner].dueDate;
        }
        return block.timestamp < periodFinish ? block.timestamp : periodFinish;
    }

    /**
     * Calculate how much reward must be given for an user
     * per token in veVault. If dueDate is less than the
     * period finish, a "negative" reward is applied to
     * ensure that rewards are applied only until this
     * date.
     */
    function rewardPerToken(address owner) public view returns (uint256) {
        uint256 _totalSupply = IVeVault(vault).totalSupply();

        if (_totalSupply == 0) {
            return rewardPerTokenStored;
        }
        uint256 userLastTime = lastTimeRewardApplicable(owner);
        
        // Apply a negative reward per token when
        // due date is already over.
        if (userLastTime < lastUpdateTime) {
            return rewardPerTokenStored
                - ((lastUpdateTime - userLastTime)
                    * rewardRate
                    * 1e18
                    / _totalSupply
                );
        }
        return rewardPerTokenStored
                + ((userLastTime - lastUpdateTime)
                    * rewardRate
                    * 1e18
                    / _totalSupply
                );
    }
    
    /**
     * Calculates how much rewards a staker earned 
     * until this moment. Only apply reward until
     * period finish or unlock date.
     */
    function earned(address owner) public view returns (uint256) {
        uint256 currentReward = rewardPerToken(owner);
        uint256 paidReward = accounts[owner].rewardPerTokenPaid;

        uint256 moreReward = 0;
        if (currentReward > paidReward) {
            moreReward = IVeVault(vault).balanceOf(owner)
                            * (currentReward - paidReward)
                            / 1e18;
        }
        return accounts[owner].rewards + moreReward;
    }

    function getRewardForDuration() external view returns (uint256) {
        return rewardRate * rewardsDuration;
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    /**
     * Notify the reward contract about a deposit in the
     * veVault contract. This is important to assure the
     * depositer will account his rewards.
     */
    function notifyDeposit() public updateReward(msg.sender) returns(Account memory) {
        emit NotifyDeposit(msg.sender, accounts[owner].rewardPerTokenPaid, accounts[owner].dueDate);
        return accounts[owner];
    }

    /**
     * Claim rewards for user. In case of no rewards claimable
     * just update the user status and do nothing.
     */
    function getReward() public updateReward(msg.sender) {
        uint256 reward = accounts[msg.sender].rewards;
        if (reward <= 0) return;
        
        accounts[msg.sender].rewards = 0;
        IERC20(rewardsToken).safeTransfer(msg.sender, reward);
        emit RewardPaid(msg.sender, reward);
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    /**
     * Set the contract to start distribuiting rewards
     * for ve holders.
     */
    function notifyRewardAmount(uint256 reward)
            external
            override 
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
        if (rewardRate > balance / rewardsDuration) revert RewardTooHigh();

        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp + rewardsDuration;
        emit RewardAdded(reward);
    }

    function recoverERC20(address tokenAddress, uint256 tokenAmount) external onlyOwner {
        IERC20(tokenAddress).safeTransfer(owner, tokenAmount);
        emit Recovered(tokenAddress, tokenAmount);
    }

    function setRewardsDuration(uint256 _rewardsDuration) external onlyOwner {
        if (block.timestamp <= periodFinish) revert RewardPeriodNotComplete(periodFinish);

        rewardsDuration = _rewardsDuration;
        emit RewardsDurationUpdated(rewardsDuration);
    }
    
    /* ========== MODIFIERS ========== */

    /**
     * Update user rewards accordlingly to
     * the current timestamp.
     */
    modifier updateReward(address owner) {
        rewardPerTokenStored = rewardPerToken(address(0));
        lastUpdateTime = lastTimeRewardApplicable(address(0));

        if (owner != address(0)) {
            if (accounts[owner].rewardPerTokenPaid == 0)
                accounts[owner].rewardPerTokenPaid = rewardPerTokenStored;
            accounts[owner].dueDate = IVeVault(vault).unlockDate(owner);
            accounts[owner].rewards = earned(owner);
            accounts[owner].rewardPerTokenPaid = rewardPerToken(address(0));
        }
        _;
    }

    /* ========== EVENTS ========== */

    event RewardAdded(uint256 reward);
    event RewardPaid(address indexed user, uint256 reward);
    event RewardsDurationUpdated(uint256 newDuration);
    event NotifyDeposit(address indexed user, uint256 rewardPerTokenPaid, uint256 dueDate);
    event Recovered(address token, uint256 amount);
}