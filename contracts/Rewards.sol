// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./interfaces/IVeVault.sol";

// Inheritance
import "./RewardsDistributionRecipient.sol";
import "./Trustable.sol";

// Custom errors
error RewardTooHigh();
error RewardPeriodNotComplete(uint256 finish);
error NotWhitelisted();
error InsufficientBalance(uint256 available, uint256 required);
error UserHasNoVeToken();

/**
 * @title Implements a reward system which grant rewards based on veToken balance
 * @author gcontarini jocorrei
 * @notice This implementation was inspired by the StakingReward contract from Synthetixio
 * @dev Implement a new constructor to deploy this contract
 */
contract Rewards is
    RewardsDistributionRecipient,
    ReentrancyGuard,
    Trustable
{
    using SafeERC20 for IERC20;

    struct Account {
        uint256 rewardPerTokenPaid;
        uint256 rewards;
        uint248 dueDate;
        bool    isStarted;
    }

    /* ========== STATE VARIABLES ========== */

    address public rewardsToken;
    address public vault; // address of the ve vault
    uint256 public periodFinish = 0; // end of the rewardDuration period
    uint256 public rewardRate = 0; // rewards per second distributed by the contract ==> rewardavailable / rewardDuration
    uint256 public rewardsDuration = 7 days; // the rewards inside the contract are gone be distributed during this period
    uint256 public lastUpdateTime; // when the reward period started
    uint256 public rewardPerTokenStored; // amounts of reward per staked token

    mapping(address => Account) public accounts;

    // Only allow recoverERC20 from this list
    mapping(address => bool) public whitelistRecoverERC20;

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

    /**
     * @notice Get the vault address
     */
    function getVaultAddress() public view returns (address) {
        return vault;
    }

    /**
     * @notice Get the dueDate for a user. This should be equal to
     * user's veVault unlockDate. If is zero, the user is not registered.
     * @return dueDate that should be the unlockDate of veVault
     * @dev returns 0 if user is not registered
     */
    function getDueDate(address user) public view returns (uint256) {
        return accounts[user].dueDate;
    }

    /**
     * @notice Get registered for rewards status of a user
     * @param user The address of the user
     * @return bool if the user is registered for rewards
     * @dev a user is registered if the dueDate is not zero and
     * the dueDate is equal to the unlockDate of the veVault
     * and due date is not due yet.
     * @dev there's a edge case where the user restaked tokens
     * but kept the same due date. In that case, the user is missing
     * a notify but the function will return true anyway.
     */
    function isRegistered(address user) public view returns (bool) {
        uint dueDate = accounts[user].dueDate;
        return
            dueDate != 0 &&
            dueDate > block.timestamp &&
            dueDate == IVeVault(vault).unlockDate(user);
    }

    /**
     * @notice Pick the correct date for applying the reward
     * Apply until the end of periodFinish or until
     * unlockDate for funds in the veVault
     * @return date which the reward is applicable for and address
     */
    function lastTimeRewardApplicable(
        address owner
    ) public view returns (uint256) {
        if (owner != address(0) && accounts[owner].dueDate < periodFinish) {
            return
                block.timestamp < accounts[owner].dueDate
                    ? block.timestamp
                    : accounts[owner].dueDate;
        }
        return block.timestamp < periodFinish ? block.timestamp : periodFinish;
    }

    /**
     * @notice Calculate how much reward must be given for an user
     * per token in veVault.
     * @dev If dueDate is less than the period finish,
     * a "negative" reward is applied to ensure that
     * rewards are applied only until this date.
     * @return amount of reward per token an addres is elegible to receive so far
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
            return
                rewardPerTokenStored -
                (((lastUpdateTime - userLastTime) * rewardRate * 1e18) /
                    _totalSupply);
        }
        return
            rewardPerTokenStored +
            (((userLastTime - lastUpdateTime) * rewardRate * 1e18) /
                _totalSupply);
    }

    /**
     * @notice Calculates how much rewards a staker earned
     * until this moment.
     * @dev Only apply reward until period finish or unlock date.
     * @return amount of reward available to claim
     */
    function earned(address owner) public view returns (uint256) {
        if (accounts[owner].dueDate == 0) {
            revert UserHasNoVeToken();
        }
        uint256 currentReward = rewardPerToken(owner);
        uint256 paidReward = accounts[owner].rewardPerTokenPaid;

        uint256 moreReward = 0;
        if (currentReward > paidReward) {
            moreReward =
                (IVeVault(vault).balanceOf(owner) *
                    (currentReward - paidReward)) /
                1e18;
        }
        return accounts[owner].rewards + moreReward;
    }

    /**
     * @notice Total rewards that will be paid during the distribution
     */
    function getRewardForDuration() external view returns (uint256) {
        return rewardRate * rewardsDuration;
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    /**
     * @notice Notify the reward contract about a deposit in the
     * veVault contract. This is important to assure the
     * contract will account user's rewards.
     * @return account full information
     */
    function notifyDeposit(
        address user
    )
        public
        onlyTrustedControllers
        updateReward(user)
        returns (Account memory)
    {
        emit NotifyDeposit(
            user,
            accounts[user].rewardPerTokenPaid,
            accounts[user].dueDate
        );
        return accounts[user];
    }

    /**
     * @notice Claim rewards for user.
     * @dev In case of no rewards claimable
     * just update the user status and do nothing.
     */
    function getReward(
        address user
    ) public onlyTrustedControllers updateReward(user) {
        uint256 reward = accounts[user].rewards;
        if (reward <= 0) return;

        accounts[user].rewards = 0;
        IERC20(rewardsToken).safeTransfer(user, reward);
        emit RewardPaid(user, reward);
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    /**
     * @notice Set the contract to start distribuiting rewards
     * for ve holders.
     * @param reward: amount of tokens to be distributed
     */
    function notifyRewardAmount(
        uint256 reward
    ) external override onlyRewardsDistribution updateReward(address(0)) {
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

    /**
     * @notice Allow owner to change reward duration
     * Only allow the change if period finish has already ended
     */
    function setRewardsDuration(uint256 _rewardsDuration) external onlyOwner {
        if (block.timestamp <= periodFinish)
            revert RewardPeriodNotComplete(periodFinish);

        rewardsDuration = _rewardsDuration;
        emit RewardsDurationUpdated(rewardsDuration);
    }

    /**
     * @notice Added to support to recover ERC20 token within a whitelist
     */
    function recoverERC20(
        address tokenAddress,
        uint256 tokenAmount
    ) external onlyOwner {
        if (whitelistRecoverERC20[tokenAddress] == false)
            revert NotWhitelisted();

        uint balance = IERC20(tokenAddress).balanceOf(address(this));
        if (balance < tokenAmount)
            revert InsufficientBalance({
                available: balance,
                required: tokenAmount
            });

        IERC20(tokenAddress).safeTransfer(owner, tokenAmount);
        emit Recovered(tokenAddress, tokenAmount);
    }

    /**
     * @dev It's possible to owner whitelist the underlying token
     * and do some kind of rugpull. To prevent that, it'recommended
     * that owner is a multisig address. Also, it emits an event
     * of changes in the ERC20 whitelist as a safety check.
     * @notice Owner can whitelist an ERC20 to recover it afterwards.
     * Emits and event to notify all users about it
     * @param flag: true to allow recover for the token
     */
    function changeWhitelistRecoverERC20(
        address tokenAddress,
        bool flag
    ) external onlyOwner {
        whitelistRecoverERC20[tokenAddress] = flag;
        emit ChangeWhitelistERC20(tokenAddress, flag);
    }

    /**
     * @notice Added to support to recover ERC721
     */
    function recoverERC721(
        address tokenAddress,
        uint256 tokenId
    ) external onlyOwner {
        IERC721(tokenAddress).safeTransferFrom(address(this), owner, tokenId);
        emit RecoveredNFT(tokenAddress, tokenId);
    }

    /* ========== MODIFIERS ========== */

    /**
     * @dev Update user rewards accordlingly to
     * the current timestamp.
     */
    modifier updateReward(address owner) {
        rewardPerTokenStored = rewardPerToken(address(0));
        lastUpdateTime = lastTimeRewardApplicable(address(0));

        if (owner != address(0)) {
            if (!accounts[owner].isStarted)
            {
                accounts[owner].isStarted = true;
                accounts[owner].rewardPerTokenPaid = rewardPerTokenStored;
            }
            accounts[owner].dueDate = uint248(IVeVault(vault).unlockDate(owner));
            accounts[owner].rewards = earned(owner);
            accounts[owner].rewardPerTokenPaid = rewardPerToken(address(0));
        }
        _;
    }

    /* ========== EVENTS ========== */

    event RewardAdded(uint256 reward);
    event RewardPaid(address indexed user, uint256 reward);
    event RewardsDurationUpdated(uint256 newDuration);
    event NotifyDeposit(
        address indexed user,
        uint256 rewardPerTokenPaid,
        uint256 dueDate
    );
    event Recovered(address token, uint256 amount);
    event RecoveredNFT(address tokenAddress, uint256 tokenId);
    event ChangeWhitelistERC20(
        address indexed tokenAddress,
        bool whitelistState
    );
}
