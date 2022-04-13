pragma solidity ^0.8.0;

import "openzeppelin-solidity-2.3.0/contracts/math/SafeMath.sol";
import "openzeppelin-solidity-2.3.0/contracts/token/ERC20/ERC20Detailed.sol";

contract Vault {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  uint256 public totalStakedToken;
  IERC20 public stakingToken;
  mapping(address => uint256) public balances;

  constructor(address _stakingToken){
    stakingToken = IERC20(_stakingToken);
  }


  function stake(uint256 amount) external {
    require(amount > 0, "Cannot stake 0");
    totalStakedToken = totalStakedToken + amount;
    balances[msg.sender] = balances[msg.sender] + amount;
    stakingToken.safeTransferFrom(msg.sender, address(this), amount);
  }

  function unstake(uint256 amount) external {
    require(amount > 0, "Cannot stake 0");
    require(amount <= balances[msg.sender], "Cannot unstake more than you staked");

    
  }

  function getVeBalance(address user) public view returns(uint256 balance){
    return(balance[msg.sender].mul(2));
  }

  function getVeTotalSupply() public view returns(uint256 balance){
    return(totalStakedToken.mul(2));
  }
}