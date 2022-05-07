import hre = require("hardhat");
import { ethers } from "hardhat";

async function main() {
  // Options to deploy
  const tokenSupply = 100000000;

  // Get signer address
  const [deployer] = await ethers.getSigners();
  console.log("Current deployer addresses:", deployer.address);

  // Contract factories 
  const NewOrderToken = await ethers.getContractFactory("NewOrderToken");
  const VeNewO = await ethers.getContractFactory("VeNewO");
  const RewardNewO = await ethers.getContractFactory("Rewards");
	const XNewO = await ethers.getContractFactory("XNewO");

  // Deploy ERC20 token
  const newo = await NewOrderToken.deploy(tokenSupply * 2);
  await newo.deployed();
  console.log("NewO deployed to:", newo.address);
  
  // Deploy ERC20 token
  const xToken = await NewOrderToken.deploy(tokenSupply);
  await xToken.deployed();
  console.log("xToken to provide liquidity", xToken.address);

  // Deploy vault
  const veNewo = await VeNewO.deploy(deployer.address, newo.address, 604800, 7776000, 94608000, 2, 15, 5, 86400)
  await veNewo.deployed();
  
  // Deploy reward
  const rewardNewO = await RewardNewO.deploy(deployer.address, veNewo.address, deployer.address, newo.address);
	await rewardNewO.deployed();
  
  // Deploy LP pool
  // Needs a LP pool contract (Uniswap V2)
  // Deploy LP reward
  // const xNewo = await XNewO.deploy(deployer.address, lp.address, newo.address, veNewo.address, deployer.address);
  
  console.log("veNewO deployed to:", veNewo.address);
  console.log("rewardNewO deployed to:", rewardNewO.address);
  // console.log("xNewo deployed to:", xNewo.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
