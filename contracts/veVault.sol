pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// Inheritance
import "./Pausable.sol";

// https://docs.synthetix.io/contracts/source/contracts/StakingRewards
contract VeVault is ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    /* ========== STATE VARIABLES ========== */

    IERC20 public stakingToken;

    uint256 private _totalSupply;
    uint256 private _totalValueLocked;
    uint256 private _bountyReward;
    uint256 private _gracePeriod;
    bool    private enforceTime;
    mapping(address => uint256) private _balances;
    mapping(address => uint256) private _veBalances;
    // A better name for it?
    mapping(address => uint256) private _unlock;

    /* ========== CONSTRUCTOR ========== */

    constructor(
        address owner_,
        address stakingToken_,
        uint256 bountyReward_,
        uint256 gracePeriod_
    ) Owned(owner_) {
        stakingToken = IERC20(stakingToken_);
        _bountyReward = bountyReward_;
        _gracePeriod = gracePeriod_; 
        enforceTime = true;
        paused = false;
    }

    /* ========== VIEWS ========== */

    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    function totalValueLocked() external view returns (uint256) {
        return _totalValueLocked;
    }

    function balanceOf(address account) external view returns (uint256) {
        return _veBalances[account];
    }
    
    function stakeBalanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }
    
    // Which name to use?
    function unlockOf(address account) external view returns (uint256) {
        return _unlock[account];
    }

    function gracePeriod() external view returns (uint256) {
        return _gracePeriod;
    }
    
    function bountyReward() external view returns (uint256) {
        return _bountyReward;
    }
    
    /* ========== PURE FUNCTIONS ========== */

    /**
     * @dev Super linear function.
     * Calculate the multipler applied to
     * the amount of tokens staked.
     * timeS: time in seconds
     */
    function veMult(uint timeS) internal pure returns (uint256) {
        // seconds in a day 86400
        return (
            (((timeS / 86400) ** 3) * 154143856)
            - (((timeS / 86400) ** 2) * 74861590400)
            + ((timeS / 86400) * 116304927000000 * 9002656460000000)
            ) / (1e17);
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    /**
     * Lock the NewO tokens and receive veNewO.
     * Time in seconds.
     * Min stake time: 3 months (7776000 seconds)
     * Max stake time: 3 years (94608000 seconds)
     * Lock time is increased when restaking is done.
     */
    function stake(uint256 amount, uint256 time) external nonReentrant notPaused {
        require(amount > 0, "Cannot stake 0");
        
        _updateLock(msg.sender, time);
        _mint(msg.sender, amount * veMult(time));

        _totalValueLocked = _totalValueLocked + amount;
        _balances[msg.sender] = _balances[msg.sender];
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount);
    }
    
    function withdraw() public nonReentrant {
        _withdraw(
            msg.sender, 
            _veBalances[msg.sender], 
            _balances[msg.sender]
            );
    }
    
    function withdrawTo(address account) external nonReentrant {
        require(account != address(0), "Cannot withdraw for null address");

        if (enforceTime) {
            require(block.timestamp - _unlock[account] > _gracePeriod, "Funds in grace period.");
        }
        
        uint256 amount = _balances[account];
        uint256 bReward = (amount * _bountyReward) / 100;

        _payBountyReward(account, bReward);
        
        _withdraw(
            account, 
            _veBalances[account], 
            amount - bReward
            );
    }

    /**
    * Change the unlock rule to allow
    * withdraws. Ignores the rule if set to false.
    */
    function changeUnlockRule(bool flag) external onlyOwner {
        enforceTime = flag;
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    function _mint(address account, uint256 mint) internal {
        _totalSupply += mint;
        _veBalances[account] += mint;
        emit Mint(account, mint);
    }

    function _updateLock(address account, uint256 time) internal {
        require(time >= 7776000, "Min of 3 months stake");
        require(time <= 94608000, "Max of 3 years stake");

        uint256 unlockTime = block.timestamp + time;
        if (_unlock[account] < unlockTime) {
            _unlock[account] = unlockTime;
        } else {
            _unlock[account] += time;
        }
    }
    
    function _burn(address account, uint256 burn) internal {
        require(_veBalances[account] >= burn, "Not enought ve to burn");
        _totalSupply -= burn;
        _veBalances[account] -= burn;
        emit Burn(account, burn);
    }

    function _withdraw(address account, uint256 burn, uint256 amount) internal {
        if (enforceTime) {
            require(block.timestamp > _unlock[account], "Funds not unlocked yet.");
        }
        // require(stakingToken.balanceOf(this.address) >= amount, "Not enought tokens");
        // require(_balances[account] >= amount, "Address has not enought funds.");

        _burn(account, burn);

        _totalValueLocked -= amount;
        _balances[account] -= amount;

        stakingToken.safeTransfer(account, amount);
        emit Withdrawn(account, amount);
    }

    function _payBountyReward(address account, uint256 reward) internal {
        _totalValueLocked -= reward;
        _balances[account] -= reward;
        stakingToken.safeTransfer(msg.sender, reward);
        emit PayBountyReward(account, msg.sender, reward);
    }

    /* ========== MODIFIERS ========== */

    // modifier updateReward(address account) {
    //     // Has to import this interface when created
    //     IRewards(_rewardContract).superUpdateReward(account);
    //     _;
    // }
    
    /* ========== EVENTS ========== */

    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event PayBountyReward(address indexed user, address indexed claimer, uint256 reward);
    event Burn(address indexed user, uint256 amount);
    event Mint(address indexed user, uint256 amount);
    // Ask marek about it
    // event Recovered(address token, uint256 amount);
}