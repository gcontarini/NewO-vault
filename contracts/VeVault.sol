// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

// Inheritance
import "./Pausable.sol";
import "./interfaces/IERC4626.sol";

import "hardhat/console.sol";

// Custom errors
error Unauthorized();
error InsufficientBalance(uint256 available, uint256 required);
error NotWhitelisted();
error FundsInGracePeriod();
error FundsNotUnlocked();

abstract contract VeVault is ReentrancyGuard, Pausable, IERC4626 {
    using SafeERC20 for IERC20;

    struct Penalty {
        uint256 gracePeriod;
        uint256 maxPerc;
        uint256 minPerc;
        uint256 stepPerc;
    }
    
    struct LockTimer {
        uint256 min;
        uint256 max;
        uint256 epoch;
        bool    enforce;
    }

    /* ========== STATE VARIABLES ========== */

    // Asset
    address public _assetTokenAddress;
    uint256 public _totalManagedAssets;
    mapping(address => uint256) public _assetBalances;

    // Share (veToken)
    uint256 private _totalSupply;
    mapping(address => uint256) public _shareBalances;
    mapping(address => uint256) private _unlockDate;

    // ERC20 metadata
    string public _name;
    string public _symbol;

    LockTimer internal _lockTimer;
    Penalty internal _penalty;

    // Constants
    uint256 private constant SEC_IN_DAY = 86400;
    uint256 private constant PRECISION = 1e2;
    // This value should be 1e17 but we are using 1e2 as precision
    uint256 private constant MULT_FACTOR = (1e17 / PRECISION);
    // Polynomial coefficients used in veMult function
    uint256 private constant COEFF_1 = 154143856;
    uint256 private constant COEFF_2 = 74861590400;
    uint256 private constant COEFF_3 = 116304927000000;
    uint256 private constant COEFF_4 = 90026564600000000;

    // Only allow recoverERC20 from this list
    mapping(address => bool) public whitelistRecoverERC20;
    
    /* ========== CONSTRUCTOR ========== */

    constructor(string memory name_, string memory symbol_) {
        _name = name_;
        _symbol = symbol_;
    }
    
    /* ========== VIEWS ========== */
    
    /**
     * The address of the underlying token 
     * used for the Vault for accounting, 
     * depositing, and withdrawing.
     */
    function asset() external view override returns (address assetTokenAddress) {
        return _assetTokenAddress;
    }

    /**
     * Total amount of the underlying asset that is “managed” by Vault.
     */
    function totalAssets() external view override returns (uint256 totalManagedAssets) {
        return _totalManagedAssets;
    }

    /**
     * Total of veTokens
     */
    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }

    /**
     * Total of veTokens currently hold by an address
     */
    function balanceOf(address account) external view override returns (uint256) {
        return _shareBalances[account];
    }

    /** 
     * Compliant to the ERC4626 interface.
     * The amount of shares that the Vault would exchange for the amount
     * of assets provided, in an ideal scenario where all the conditions are met.
     * Alwalys return the amount of veToken for the min amount of time locked.
     */
    function convertToShares(uint256 assets, uint256 lockTime) public pure returns (uint256 shares) {
        return assets * veMult(lockTime) / PRECISION;
    }

    function convertToShares(uint256 assets) override external view returns (uint256 shares) {
        return convertToShares(assets, _lockTimer.min);
    }
    
    /**
     * Compliant to the ERC4626 interface.
     * The amount of assets that the Vault would exchange for the amount 
     * of shares provided, in an ideal scenario where all the conditions are met.
     */
    function convertToAssets(uint256 shares, uint256 lockTime) public pure returns (uint256 assets) {
        return shares * PRECISION / veMult(lockTime);
    }

    function convertToAssets(uint256 shares) override external view returns (uint256 assets) {
        return convertToAssets(shares, _lockTimer.min);
    }
    
    /** 
     * Maximum amount of the underlying asset that can be deposited into
     * the Vault for the receiver, through a deposit call.
     */
    function maxDeposit(address) override external pure returns (uint256 maxAssets) {
        return 2 ** 256 - 1;
    }

    /** 
     * Compliant to the ERC4626 interface.
     * Allows an on-chain or off-chain user to simulate the effects of
     * their deposit at the current block, given current on-chain conditions.
     */
    function previewDeposit(uint256 assets, uint256 lockTime) public pure returns (uint256 shares) {
        return convertToShares(assets, lockTime);
    }

    function previewDeposit(uint256 assets) override external view returns (uint256 shares) {
        return previewDeposit(assets, _lockTimer.min);
    }
    
    /**
     * Maximum amount of shares that can be minted from the Vault for the receiver,
     * through a mint call.
     */
    function maxMint(address) override external pure returns (uint256 maxShares) {
        return 2 ** 256 - 1;
    }

    /**
     * Compliant to the ERC4626 interface.
     * Allows an on-chain or off-chain user to simulate the effects of their
     * mint at the current block, given current on-chain conditions.
     */
    function previewMint(uint256 shares, uint256 lockTime) public pure returns (uint256 assets) {
        return convertToAssets(shares, lockTime);
    }

    function previewMint(uint256 shares) override external view returns (uint256 assets) {
        return previewMint(shares, _lockTimer.min);
    }
    
    /**
     * Maximum amount of the underlying asset that can be withdrawn from the
     * owner balance in the Vault, through a withdraw call.
     */
    function maxWithdraw(address owner) override external view returns (uint256 maxAssets) {
        if (paused) {
            return 0;
        }
        return _assetBalances[owner];
    }

    /**
     * Allows an on-chain or off-chain user to simulate the effects of
     * their withdrawal at the current block, given current on-chain conditions.
     */
    function previewWithdraw(uint256 assets, uint256 lockTime) public pure returns (uint256 shares) {
        return convertToShares(assets, lockTime);
    }

    function previewWithdraw(uint256 assets) override external view returns (uint256 shares) {
        return previewWithdraw(assets, _lockTimer.min);
    }
    
    /**
     * Maximum amount of Vault shares that can be redeemed from the owner
     * balance in the Vault, through a redeem call.
     */
    function maxRedeem(address owner) override external view returns (uint256 maxShares) {
        if (paused) {
            return 0;
        }
        return _shareBalances[owner];
    }

    /**
     * Allows an on-chain or off-chain user to simulate the effects of their
     * redeemption at the current block, given current on-chain conditions.
     */
    function previewRedeem(uint256 shares, uint256 lockTime) public pure returns (uint256 assets) {
        return convertToAssets(shares, lockTime);
    }

    function previewRedeem(uint256 shares) override external view returns (uint256 assets) {
        return previewRedeem(shares, _lockTimer.min);
    }
    
    /**
     * Ve tokens are not transferable.
     * Always returns zero.
     */
    function allowance(address, address) override external pure returns (uint256) {
        return 0;
    }

    /**
     * Total assets deposited by address
     */
    function assetBalanceOf(address account) external view returns (uint256) {
        return _assetBalances[account];
    }

    /**
     * Unlock date for account
     */
    function unlockDate(address account) external view returns (uint256) {
        return _unlockDate[account];
    }

    /**
     * How long is the grace period in seconds
     */
    function gracePeriod() external view returns (uint256) {
        return _penalty.gracePeriod;
    }

    /**
     * Percentage paid to caller which withdraw veTokens
     * in name of account.
     */
    function penaltyPercentage() external view returns (uint256) {
        return _penalty.stepPerc;
    }

    /**
     * Minimum lock time in seconds
     */
     function minLockTime() external view returns (uint256) {
         return _lockTimer.min;
     }
    
    /**
     * Maximum lock time in seconds
     */
     function maxLockTime() external view returns (uint256) {
         return _lockTimer.max;
     }

     /**
     * Returns the name of the token.
     */
    function name() public view returns (string memory) {
        return _name;
    }

    /**
     * Returns the symbol of the token, usually a shorter version of the
     * name.
     */
    function symbol() public view returns (string memory) {
        return _symbol;
    }

    function decimals() public pure returns (uint8) {
        return 18;
    }
    
    /* ========== ERC20 NOT ALLOWED FUNCTIONS ========== */

    function transfer(address, uint256) external pure override returns (bool) {
        revert Unauthorized();
    }

    function approve(address, uint256) external pure override returns (bool) {
        revert Unauthorized();
    }

    function transferFrom(address, address, uint256) external pure override returns (bool) {
        revert Unauthorized();
    }

    /* ========== PURE FUNCTIONS ========== */

    /**
     * @dev Super linear function.
     * Calculate the multipler applied to
     * the amount of tokens staked.
     * lockTime: time in seconds
     * Granularity is lost with lockTime between days
     * This functions implements the following polynomial:
     * f(x) = x^3 * 1.54143856e-09 - x^2 * 7.48615904e-07 + x * 1.16304927e-03 + 9.00265646e-01
     */
    function veMult(uint256 lockTime) internal pure returns (uint256) {
        return (
            (((lockTime / SEC_IN_DAY) ** 3) * COEFF_1)
            + ((lockTime / SEC_IN_DAY) * COEFF_3)
            + (COEFF_4)
            - (((lockTime / SEC_IN_DAY) ** 2) * COEFF_2)
            ) / MULT_FACTOR;
    }
    
    /**
     * Returns the average ve multipler applied to an address
     */
    function avgVeMult(address owner) internal view returns (uint256) {
        // Protect against zero division
        if (_assetBalances[owner] == 0) {
            return 0;
        }
        return _shareBalances[owner] * PRECISION / _assetBalances[owner];
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function deposit(uint256 assets, address receiver)
            override
            external
            nonReentrant
            notPaused 
            returns (uint256 shares) {
        return _deposit(assets, receiver, _lockTimer.min);
    }
    
    /**
     * Mints shares Vault shares to receiver by
     * depositing exactly amount of underlying tokens.
     * Lock time is increased when restaking is done.
     * Only allow deposits for the caller.
     */
    function deposit(uint256 assets, address receiver, uint256 lockTime)
            external 
            nonReentrant
            notPaused 
            returns (uint256 shares) {
        return _deposit(assets, receiver, lockTime);
    }
    
    /**
     * Mints exactly shares Vault shares to
     * receiver by depositing amount of underlying tokens.
     * Lock time is increased when restaking is done.
     * Only allow deposits for the caller.
     */
    function mint(uint256 shares, address receiver, uint256 lockTime)
            external 
            nonReentrant
            notPaused
            returns (uint256 assets) {
        assets = convertToAssets(shares, lockTime);
        _deposit(assets, receiver, lockTime);
        return assets;
    }

    function mint(uint256 shares, address receiver)
            override
            external
            nonReentrant
            notPaused
            returns (uint256 assets) {
        assets = convertToAssets(shares, _lockTimer.min);
        _deposit(assets, receiver, _lockTimer.min);
        return assets;
    }

    // Burns shares from owner and sends exactly assets of underlying tokens to receiver.
    function withdraw(uint256 assets, address receiver, address owner)
            override
            external 
            nonReentrant 
            notPaused
            returns (uint256 shares) {
        return _withdraw(assets, receiver, owner);
    }

    // Burns exactly shares from owner and sends assets of underlying tokens to receiver.
    function redeem(uint256 shares, address receiver, address owner)
            override
            external 
            nonReentrant 
            notPaused
            returns (uint256 assets) {
        assets = shares * PRECISION / avgVeMult(owner);
        // This is for testing only
        uint256 testShares = _withdraw(assets, receiver, owner);
        require(testShares == shares, "DEBUG ONLY");
        
        return assets;
    }

    // Withdraw all funds for caller
    function exit()
            external 
            nonReentrant 
            notPaused
            returns (uint256 shares) {
        return _withdraw(_assetBalances[msg.sender], msg.sender, msg.sender);
    }

    /**
    * Change the unlock rule to allow
    * withdraws. Ignores the rule if set to false.
    */
    function changeUnlockRule(bool flag) external onlyOwner {
        _lockTimer.enforce = flag;
    }

    /**
     * Change state variabes which controls the penalty system
     */
    function changeGracePeriod(uint256 newGracePeriod) external onlyOwner {
        _penalty.gracePeriod = newGracePeriod;
    }
    
    function changeEpoch(uint256 newEpoch) external onlyOwner {
        _lockTimer.epoch = newEpoch;
    }
    
    function changeMinPenalty(uint256 newMinPenalty) external onlyOwner {
        _penalty.minPerc = newMinPenalty;
    }
    
    function changeMaxPenalty(uint256 newMaxPenalty) external onlyOwner {
        _penalty.maxPerc = newMaxPenalty;
    }
    
    function changeWhitelistRecoverERC20(address tokenAddress, bool flag) external onlyOwner {
        if (tokenAddress == _assetTokenAddress) revert Unauthorized();
        whitelistRecoverERC20[tokenAddress] = flag;
        emit ChangeWhitelistERC20(tokenAddress, flag);
    }

    // Added to support recovering LP Rewards from other systems such as BAL to be distributed to holders
    function recoverERC20(address tokenAddress, uint256 tokenAmount) external onlyOwner {
        if (whitelistRecoverERC20[tokenAddress] == false) revert NotWhitelisted();
        IERC20(tokenAddress).safeTransfer(owner, tokenAmount);
        emit Recovered(tokenAddress, tokenAmount);
    }

    function recoverERC721(address tokenAddress, uint256 tokenId) external onlyOwner {
        IERC721(tokenAddress).safeTransferFrom(address(this), owner, tokenId);
        emit RecoveredNFT(tokenAddress, tokenId);
    }

    /* ========== INTERNAL FUNCTIONS ========== */
    
    function _deposit(uint256 assets, address receiver, uint256 lockTime) internal returns (uint256 shares) {
        if (assets <= 0 || msg.sender != receiver
            || lockTime < _lockTimer.min || lockTime > _lockTimer.max)
            revert Unauthorized();

        // Update lockTime
        uint256 unlockTime = block.timestamp + lockTime;
        if (_unlockDate[receiver] < unlockTime)
            _unlockDate[receiver] = unlockTime;
        else
            _unlockDate[receiver] += lockTime;
        
        shares = convertToShares(assets, lockTime);
        
        // Mint ve
        _totalSupply += shares;
        _shareBalances[receiver] += shares;
        emit Mint(receiver, shares);

        // Update assets
        _totalManagedAssets += assets;
        _assetBalances[receiver] += assets;
        
        IERC20(_assetTokenAddress).safeTransferFrom(receiver, address(this), assets);
        emit Deposit(msg.sender, receiver, assets, shares);
        return shares;
    }
    
    function _withdraw(uint256 assets, address receiver, address owner) internal returns (uint256 shares) {
        if (owner == address(0)) revert Unauthorized();
        if (_assetBalances[owner] < assets)
            revert InsufficientBalance({
                available: _assetBalances[owner],
                required: assets
            });
        
        // To kickout someone
        if (msg.sender != owner) {
            if (receiver != owner)
                revert Unauthorized();
            // Must check what happens for negative value in the block.timestamp
            if (_lockTimer.enforce && (block.timestamp - _unlockDate[owner] <= _penalty.gracePeriod))
                revert FundsInGracePeriod();
        }
        else if (_lockTimer.enforce && block.timestamp <= _unlockDate[owner])
            revert FundsNotUnlocked();
        
        shares = assets * avgVeMult(owner) / PRECISION;
        if (_shareBalances[owner] < shares)
            revert InsufficientBalance({
                available: _shareBalances[owner],
                required: shares
            });
        
        // Pay reward to caller
        uint256 amountPenalty = 0;
        if (msg.sender != owner) {
            amountPenalty = _payPenalty(owner, assets);
        }
        assets -= amountPenalty;

        // Burn ve tokens
        _totalSupply -= shares;
        _shareBalances[owner] -= shares;
        emit Burn(owner, shares);

        // Withdraw assets
        _totalManagedAssets -= assets;
        _assetBalances[owner] -= assets;

        IERC20(_assetTokenAddress).safeTransfer(receiver, assets);
        emit Withdraw(msg.sender, receiver, owner, assets, shares);
        return shares;
    }

    function _payPenalty(address owner, uint256 assets) internal returns (uint256 amountPenalty) {
        uint256 penaltyAmount = _penalty.minPerc 
                        + (((block.timestamp - (_unlockDate[owner] + _penalty.gracePeriod))
                            / _lockTimer.epoch)
                        * _penalty.stepPerc);

        if (penaltyAmount > _penalty.maxPerc) {
            penaltyAmount = _penalty.maxPerc;
        }
        amountPenalty = (assets * penaltyAmount) / 100;

        // Makes sense????
        if (_assetBalances[owner] < amountPenalty)
            revert InsufficientBalance({
                available: _assetBalances[owner],
                required: amountPenalty
            });

        _totalManagedAssets -= amountPenalty;
        _assetBalances[owner] -= amountPenalty;

        IERC20(_assetTokenAddress).safeTransfer(msg.sender, amountPenalty);
        emit PayPenalty(msg.sender, owner, amountPenalty);
        return amountPenalty;
    }

    /* ========== EVENTS ========== */

    event PayPenalty(address indexed caller, address indexed owner, uint256 assets);
    event Burn(address indexed user, uint256 shares);
    event Mint(address indexed user, uint256 shares);
    event Recovered(address token, uint256 amount);
    event RecoveredNFT(address tokenAddress, uint256 tokenId);
    event ChangeWhitelistERC20(address indexed tokenAddress, bool whitelistState);
}