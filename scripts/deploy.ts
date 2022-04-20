// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import hre = require("hardhat");
import { ethers } from "hardhat";

async function main() {
  // Options to deploy
  const tokenSupply = 1000;

  // Get signer address
  const [deployer] = await ethers.getSigners();
  console.log("Current deployer addresses:", deployer.address);

  // We get the contract to deploy
  const NewOrderToken = await ethers.getContractFactory("NewOrderToken");
  // const StakingRewards = await ethers.getContractFactory("StakingRewards");
  const VeNewO = await ethers.getContractFactory("VeNewO");

  // Deploy ERC20 token
  const newo = await NewOrderToken.deploy(tokenSupply);
  await newo.deployed();
  console.log("NewO deployed to:", newo.address);

  // Deploy vault
  const veNewo = await VeNewO.deploy(deployer.address, newo.address, 604800, 7776000, 94608000, 2, 15, 5, 86400)
  console.log("veNewO deployed to:", veNewo.address);
  
  // Make allowance to veNewO
  let amountLock = 500;
  let lockTime = 7776000 + 10;
  const allowance = await newo.approve(veNewo.address, amountLock);
  // Lock nwo into veNwo
  // Function overload -- ethers bug, must use full signature
  const veLock = await veNewo["deposit(uint256,address,uint256)"] (amountLock, deployer.address, lockTime);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
