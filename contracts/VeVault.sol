// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// Inheritance
import "./Pausable.sol";
import "./interfaces/IERC4626.sol";

abstract contract VeVault is ReentrancyGuard, Pausable, IERC4626 {
    using SafeERC20 for IERC20;

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

    uint256 internal _minLockTime;
    uint256 internal _maxLockTime;
    bool    internal _enforceTime;
    uint256 internal _epoch;

    // Penalty system
    uint256 internal _gracePeriod;
    uint256 internal _maxPenalty;
    uint256 internal _minPenalty;
    uint256 internal _penaltyPerc;
    
    // Constants
    uint256 private constant SEC_IN_DAY = 86400;
    uint256 private constant PRECISION = 100;
    // This value should be 1e17 but we are using 100 as precision
    uint256 private constant MULT_FACTOR = 1e15;
    uint256 private constant COEFF_1 = 154143856;
    uint256 private constant COEFF_2 = 74861590400;
    uint256 private constant COEFF_3 = 116304927000000 * 9002656460000000;
    
    /* ========== CONSTRUCTOR ========== */

    constructor(string memory name_, string memory symbol_) {
        _name = name_;
        _symbol = symbol_;
    }
    
    // constructor(
    //     address owner_,
    //     address stakingToken_,
    //     uint256 bountyReward_,
    //     uint256 gracePeriod_,
    //     uint256 minLockTime_,
    //     uint256 maxLockTime_
    // ) Owned(owner_) {
    //     assetToken = IERC20(stakingToken_);
    //     _assetTokenAddress = stakingToken_;

    //     _penaltyPerc = bountyReward_;
    //     _gracePeriod = gracePeriod_; 
    //     _minLockTime = minLockTime_;
    //     _maxLockTime = maxLockTime_;

    //     _enforceTime = true;
    //     paused = false;
    // }
    
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
        return convertToShares(assets, _minLockTime);
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
        return convertToAssets(shares, _minLockTime);
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
        return previewDeposit(assets, _minLockTime);
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
        return previewMint(shares, _minLockTime);
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
        return previewWithdraw(assets, _minLockTime);
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
        return previewRedeem(shares, _minLockTime);
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
        return _gracePeriod;
    }

    /**
     * Percentage paid to caller which withdraw veTokens
     * in name of account.
     */
    function penaltyPercentage() external view returns (uint256) {
        return _penaltyPerc;
    }

    /**
     * Minimum lock time in seconds
     */
     function minLockTime() external view returns (uint256) {
         return _minLockTime;
     }
    
    /**
     * Maximum lock time in seconds
     */
     function maxLockTime() external view returns (uint256) {
         return _maxLockTime;
     }

     /**
     * @dev Returns the name of the token.
     */
    function name() public view returns (string memory) {
        return _name;
    }

    /**
     * @dev Returns the symbol of the token, usually a shorter version of the
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
        revert("Transfer not allowed for this token.");
    }

    function approve(address, uint256) external pure override returns (bool) {
        revert("Approve not allowed for this token.");
    }

    function transferFrom(address, address, uint256) external pure override returns (bool) {
        revert("Transfer not allowed for this token.");
    }

    /* ========== PURE FUNCTIONS ========== */

    /**
     * @dev Super linear function.
     * Calculate the multipler applied to
     * the amount of tokens staked.
     * lockTime: time in seconds
     * Granularity is lost with lockTime between days
     */
    function veMult(uint256 lockTime) internal pure returns (uint256) {
        return (
            (((lockTime / SEC_IN_DAY) ** 3) * COEFF_1)
            + ((lockTime / SEC_IN_DAY) * COEFF_3)
            - (((lockTime / SEC_IN_DAY) ** 2) * COEFF_2)
            ) / MULT_FACTOR;
    }
    
    /**
     * Returns the average ve multipler applied to an address
     */
    function avgVeMult(address owner) public view returns (uint256) {
        return _shareBalances[owner] * PRECISION / _assetBalances[owner];
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function deposit(uint256 assets, address receiver)
            override
            external
            nonReentrant
            notPaused 
            returns (uint256 shares) {
        return _deposit(assets, receiver, _minLockTime);
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
        assets = convertToAssets(shares, _minLockTime);
        _deposit(assets, receiver, _minLockTime);
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
        assets = (shares * PRECISION / avgVeMult(owner)) / PRECISION;
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
        _enforceTime = flag;
    }

    /**
     * Change state variabes which controls the penalty system
     */
    function changeGracePeriod(uint256 newGracePeriod) external onlyOwner {
        _gracePeriod = newGracePeriod;
    }
    
    function changeEpoch(uint256 newEpoch) external onlyOwner {
        _epoch = newEpoch;
    }
    
    function changeMinPenalty(uint256 newMinPenalty) external onlyOwner {
        _minPenalty = newMinPenalty;
    }
    
    function changeMaxPenalty(uint256 newMaxPenalty) external onlyOwner {
        _maxPenalty = newMaxPenalty;
    }

    // Added to support recovering LP Rewards from other systems such as BAL to be distributed to holders
    function recoverERC20(address tokenAddress, uint256 tokenAmount) external onlyOwner {
        require(tokenAddress != _assetTokenAddress, "Cannot withdraw the staking token");
        IERC20(tokenAddress).safeTransfer(owner, tokenAmount);
        emit Recovered(tokenAddress, tokenAmount);
    }

    /* ========== INTERNAL FUNCTIONS ========== */
    
    function _deposit(uint256 assets, address receiver, uint256 lockTime) internal returns (uint256 shares) {
        require(assets > 0, "Cannot deposit 0");
        require(msg.sender == receiver, "Cannot deposit for another address.");
        require(lockTime >= _minLockTime, "Lock time is less than min.");
        require(lockTime <= _maxLockTime, "Lock time is more than max.");

        // Update lockTime
        uint256 unlockTime = block.timestamp + lockTime;
        if (_unlockDate[owner] < unlockTime) {
            _unlockDate[owner] = unlockTime;
        } else {
            _unlockDate[owner] += lockTime;
        }
        
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
        require(owner != address(0), "Cannot withdraw for null address");
        require(_assetBalances[owner] >= assets, "Address has not enought assets.");
        if (msg.sender != owner) {
            require(receiver == owner, "Must withdraw to owner address.");
            // Must check what happens for negative value in the block.timestamp
            if (_enforceTime) {
                require(block.timestamp - _unlockDate[owner] > _gracePeriod, "Funds in grace period.");
            }
        }
        else if (_enforceTime) {
            require(block.timestamp > _unlockDate[owner], "Funds not unlocked yet.");
        }

        // Pay reward to caller
        uint256 amountPenalty = 0;
        if (msg.sender != owner) {
            amountPenalty = _payPenalty(owner, assets);
        }

        // This can be tricker, test it carefully
        shares = assets * avgVeMult(owner) / PRECISION;
        require(_shareBalances[owner] >= shares, "Not enought shares to burn.");
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
        uint256 penalty = _minPenalty 
                        + (((_unlockDate[owner] - block.timestamp)
                            / _epoch)
                        * _penaltyPerc);

        if (penalty > _maxPenalty) {
            penalty = _maxPenalty;
        }
        amountPenalty = (assets * penalty) / 100;

        // Makes sense????
        require(_assetBalances[owner] >= amountPenalty , "Not enought funds to pay penalty.");

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
}