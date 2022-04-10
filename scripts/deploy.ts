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
  const StakingRewards = await ethers.getContractFactory("StakingRewards");

  // Deploy token
  const newo = await NewOrderToken.deploy(tokenSupply);
  await newo.deployed();
  console.log("NewO Token deployed", newo.address);

  // Deploy vault
  // Second parameter is the rewardDistribution contract
  // right now, we just the same address as deployer 
  const vault = await StakingRewards.deploy(deployer.address, deployer.address, newo.address, newo.address)
  console.log("Vault deployed to:", vault.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
