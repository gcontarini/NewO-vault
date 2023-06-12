// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

// Inheritance
import "./RewardsDistributionRecipient.sol";
import "./Pausable.sol";
import "./Trustable.sol";

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
 * staked in this contract and grants boosts based on depositor veToken balance
 * @author gcontarini jocorrei
 * @dev This implementation tries to follow the ERC4626 standard
 * Implement a new constructor to deploy this contract
 */
abstract contract LpRewards is ReentrancyGuard, Pausable, RewardsDistributionRecipient, IERC4626, Trustable {
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
     * @notice Address of asset token
     */
    function asset() override external view returns (address assetTokenAddress) {
        return assetToken;
    }

    /**
     * @notice Total of LP tokens hold by the contract
     */
    function totalAssets() override external view returns (uint256 totalManagedAssets) {
        return total.managedAssets;
    }

    /**
     * @notice Total of shares minted by the contract
     * This value is important to calculate the percentage
     * of reward for each staker
     */
    function totalSupply() override external view returns (uint256) {
        return total.supply;
    }

    /**
     * @notice Amount of shares an address has
     */
    function balanceOf(address owner) override external view returns (uint256) {
        return accounts[owner].shares;
    }

    /**
     * @notice Amount of LP staked by an address
     */
    function assetBalanceOf(address owner) external view returns (uint256) {
        return accounts[owner].assets;
    }

    /**
     * @notice Maximum amount of the underlying asset that can
     * be deposited into the Vault for the receiver, through a deposit call.
     * @dev Compliant to the ERC4626 interface.
     */
    function maxDeposit(address) override external pure returns (uint256 maxAssets) {
        return 2 ** 256 - 1;
    }

    /**
     * @notice Maximum amount of shares that can be minted from the
     * Vault for the receiver, through a mint call.
     * @dev Compliant to the ERC4626 interface.
     */
    function maxMint(address) override external pure returns (uint256 maxShares) {
        return 2 ** 256 - 1;
    }

    /**
     * @notice Maximum amount of the underlying asset that can be withdrawn from the
     * owner balance in the Vault, through a withdraw call.
     * @dev Compliant to the ERC4626 interface.
     */
    function maxWithdraw(address owner) override external view returns (uint256 maxAssets) {
        if (paused) {
            return 0;
        }
        return accounts[owner].assets;
    }

    /**
     * @notice Maximum amount of Vault shares that can be redeemed from the owner balance in the Vault, through a redeem call.
     * @dev Compliant to the ERC4626 interface.
     */
    function maxRedeem(address owner) override external view returns (uint256 maxShares) {
        if (paused) {
            return 0;
        }
        // Since assets and (shares - sharesBoost) have an 1:1 ratio
        return accounts[owner].assets;
    }

    /**
     * @notice The amount of shares that the Vault would exchange
     * for the amount of assets provided, in an ideal scenario where
     * all the conditions are met.
     * @dev Compliant to the ERC4626 interface.
     */
    function convertToShares(uint256 assets) override external view returns (uint256 shares) {
        return assets * getMultiplier(msg.sender) / PRECISION;
    }

    /**
     * @notice The amount of assets that the Vault would exchange
     * for the amount of shares provided, in an ideal scenario where
     * all the conditions are met.
     * @dev Compliant to the ERC4626 interface.
     */
    function convertToAssets(uint256 shares) override external view returns (uint256 assets) {
        return shares * PRECISION / getMultiplier(msg.sender);
    }

    /**
     * @notice Allows an on-chain or off-chain user to simulate the
     * effects of their deposit at the current block, given current on-chain conditions.
     * @dev Compliant to the ERC4626 interface.
     */
    function previewDeposit(uint256 assets) override external view returns (uint256 shares) {
        return assets * getMultiplier(msg.sender) / PRECISION;
    }

    /**
     * @notice Allows an on-chain or off-chain user to simulate the
     * effects of their mint at the current block, given current on-chain conditions.
     * @dev Compliant to the ERC4626 interface.
     */
    function previewMint(uint256 shares) override external view returns (uint256 assets) {
         return shares * PRECISION / getMultiplier(msg.sender);
    }

    /**
     * @notice Allows an on-chain or off-chain user to simulate the effects of their
     * withdrawal at the current block, given current on-chain conditions.
     * @dev Compliant to the ERC4626 interface.
     */
    function previewWithdraw(uint256 assets) override external view returns (uint256 shares) {
        return assets * getMultiplier(msg.sender) / PRECISION;
    }

    /**
     * @notice Allows an on-chain or off-chain user to simulate the effects of their
     * redeemption at the current block, given current on-chain conditions.
     * @dev Compliant to the ERC4626 interface.
     */
    function previewRedeem(uint256 shares) override external view returns (uint256 assets) {
        return shares * PRECISION / getMultiplier(msg.sender);
    }

    /**
     * @notice xNEWO tokens are not transferable.
     * @dev Always returns zero.
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

    /**
     * @notice ERC20 transfer are not allowed
     */
    function transfer(address, uint256) external pure override returns (bool) {
        revert Unauthorized();
    }

    /**
     * @notice ERC20 approve are not allowed
     */
    function approve(address, uint256) external pure override returns (bool) {
        revert Unauthorized();
    }

    /**
     * @notice ERC20 transferFrom are not allowed
     */
    function transferFrom(address, address, uint256) external pure override returns (bool) {
        revert Unauthorized();
    }

    /* ============== REWARD FUNCTIONS ====================== */

    /**
     * @notice Notify the reward contract about a deposit in the
     * veVault contract. This is important to assure the
     * contract will update account user's rewards.
     * @return account with full information
     */
    function notifyDeposit() public updateReward(msg.sender) updateBoost(msg.sender) returns(Account memory) {
        emit NotifyDeposit(msg.sender, accounts[msg.sender].assets, accounts[msg.sender].shares);
        return accounts[msg.sender];
    }

    /**
     * @notice Pick the correct date for applying the reward
     * Apply until the end of periodFinish or now
     * @return date which rewards are applicable
     */
    function lastTimeRewardApplicable() public view returns (uint256) {
        return block.timestamp < periodFinish ? block.timestamp : periodFinish;
    }

    /**
     * @notice Calculate how much reward must be given for an user
     * per token staked.
     * @return amount of reward per token updated
     */
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

    /**
     * @notice Calculates how much rewards a staker earned
     * until this moment.
     * @return amount of rewards earned so far
     */
    function earned(address owner) public view returns (uint256) {
        return accounts[owner].rewards
                + (accounts[owner].shares
                    * (rewardPerToken() - accounts[owner].rewardPerTokenPaid)
                    / PRECISION);
    }

    /**
     * @notice Total rewards that will be paid during the distribution
     */
    function getRewardForDuration() external view returns (uint256) {
        return rewardRate * rewardsDuration;
    }

    /**
     * @notice Claim rewards for user.
     * @dev In case of no rewards claimable
     * just update the user status and do nothing.
     */
    function getReward() public updateReward(msg.sender) returns (uint256 reward) {
        reward = accounts[msg.sender].rewards;
        if(reward <= 0)
            revert UnauthorizedClaim();
        accounts[msg.sender].rewards = 0;
        IERC20(rewardsToken).safeTransfer(msg.sender, reward);
        emit RewardPaid(msg.sender, reward);
        return reward;
    }

    /**
     * @notice Set the contract to start distribuiting rewards
     * for stakers.
     * @param reward: amount of tokens to be distributed
     */
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

    /**
     * @notice Allow owner to change reward duration
     * Only allow the change if period finish has already ended
     */
    function setRewardsDuration(uint256 _rewardsDuration) external onlyOwner {
        if (block.timestamp <= periodFinish)
            revert Unauthorized();
        rewardsDuration = _rewardsDuration;
        emit RewardsDurationUpdated(rewardsDuration);
    }

    /* =================  GET EXTERNAL INFO  =================== */

    /**
     * @notice Get how much token (not veToken) owner has in the provided LP
     */
    function getNewoShare(address owner) public view returns (uint256) {
        uint112 reserve0; uint112 reserve1; uint32 timestamp;

        (reserve0, reserve1, timestamp) = IUniswapV2Pair(assetToken).getReserves();
        return accounts[owner].assets * reserve0
                / IUniswapV2Pair(assetToken).totalSupply();
    }

    /**
     * @notice Get the multiplier applied for the address in the veVault contract
     */
    function getMultiplier(address owner) public view returns (uint256) {
        IVeVault veToken = IVeVault(veVault);
        uint256 assetBalance = veToken.assetBalanceOf(owner);

        // to make sure that there is no division by zero
        if (assetBalance == 0)
            return 1;
        return veToken.balanceOf(owner) * PRECISION / assetBalance;
    }

    /**
     * @notice Get how much newo an address has locked in veVault
     */
    function getNewoLocked(address owner) public view returns (uint256) {
        return IVeVault(veVault).assetBalanceOf(owner);
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    /**
     * @notice Mints shares to receiver by depositing exactly amount of underlying tokens.
     * @dev Compliant to the ERC4626 interface.
     * @param assets: amount of underlying tokens
     * @param receiver: address which the veTokens will be granted to
     * @return shares minted for receiver
     */
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

    /**
     * @dev Not compliant to the ERC4626 interface.
     * Due to rounding issues, would be very hard and
     * gas expensive to make it properly works.
     * To avoid a bad user experience this function
     * will always revert.
     */
    function mint(uint256, address)
            override
            external
            pure
            returns (uint256) {
        revert NotImplemented();
    }

    /**
     * @notice Burns shares from owner and sends exactly
     * assets of underlying tokens to receiver.
     * Allows owner to send their assets to another
     * address.
     * @dev Compliant to the ERC4626 interface
     * @param assets: amount of underlying tokens
     * @param receiver: address which tokens will be transfered to
     * @param owner: address which controls the veTokens
     * @return shares burned from owner
     */
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

    /**
     * @dev Not compliant to the ERC4626 interface.
     * Due to rounding issues, would be very hard and
     * gas expensive to make it properly works.
     * To avoid a bad user experience this function
     * will always revert.
     */
    function redeem(uint256, address, address)
            override
            external
            pure
            returns (uint256) {
        revert NotImplemented();
    }

    /**
     * @notice Perform a full withdraw
     * for caller and get all remaining rewards
     * @return reward claimed by the caller
     */
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

    /**
     * @dev Handles internal withdraw logic
     * Burns the correct shares amount and
     * transfer assets to receiver.
     * Only allows receiver equal owner
     * @param assets: amount of tokens to withdraw
     * @param shares: amount of shares to burn
     * @param receiver: address which the tokens will transfered to
     * @param owner: address which controls the shares
     */
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

    /**
     * @dev Handles internal deposit logic
     * Mints the correct shares amount and
     * transfer assets from caller to vault.
     * @param assets: amount of tokens to deposit
     * @param shares: amount of shares to mint
     * @param receiver: address which the shares will be minted to, must be the same as caller
     */
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

    /**
     * @notice Owner can whitelist an ERC20 to recover it afterwards.
     * Emits and event to notify all users about it
     * @dev It's possible to owner whitelist the underlying token
     * and do some kind of rugpull. To prevent that, it'recommended
     * that owner is a multisig address. Also, it emits an event
     * of changes in the ERC20 whitelist as a safety check.
     * @param flag: true to allow recover for the token
     */
    function changeWhitelistRecoverERC20(address tokenAddress, bool flag) external onlyOwner {
        whitelistRecoverERC20[tokenAddress] = flag;
        emit ChangeWhitelistERC20(tokenAddress, flag);
    }

    /**
     * @notice Added to support to recover ERC20 token within a whitelist
     */
    function recoverERC20(address tokenAddress, uint256 tokenAmount) external onlyOwner {
        if (whitelistRecoverERC20[tokenAddress] == false) revert NotWhitelisted();

        uint balance = IERC20(tokenAddress).balanceOf(address(this));
        if (balance < tokenAmount) revert InsufficientBalance();

        IERC20(tokenAddress).safeTransfer(owner, tokenAmount);
        emit Recovered(tokenAddress, tokenAmount);
    }

    /**
     * @notice Added to support to recover ERC721
     */
    function recoverERC721(address tokenAddress, uint256 tokenId) external onlyOwner {
        IERC721(tokenAddress).safeTransferFrom(address(this), owner, tokenId);
        emit RecoveredNFT(tokenAddress, tokenId);
    }

    /* ========== MODIFIERS ========== */

    /**
     * @dev Always apply this to update the current state
     * of earned rewards for caller
     */
    modifier updateReward(address owner) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        if (owner != address(0)) {
            accounts[owner].rewards = earned(owner);
            accounts[owner].rewardPerTokenPaid = rewardPerTokenStored;
        }
        _;
    }

    /**
     * @dev Whenever the amount of assets is changed
     * this will check and update the boosts correctly
     * This action can burn or mint new shares if necessary
     */
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
    event NotifyDeposit(address indexed user, uint256 assetBalance, uint256 sharesBalance);
    event BoostUpdated(address indexed owner, uint256 totalShares, uint256 boostShares);
}