import hre = require("hardhat");
import { ethers } from "hardhat";

async function main() {
	const [deployer] = await ethers.getSigners()
	console.log("Deployer:", deployer.address);

	// Address for the SushiSwap: NEWO-USDC pair
	const addressLPusdc = "0xc08ED9a9ABEAbcC53875787573DC32Eee5E43513";
	// Address of the NEWO token
	const newoAddress = "0x98585dFc8d9e7D48F0b1aE47ce33332CF4237D96";

	/* ============ Get Factory of contracts to deploy ========= */
	
	const VeNewO = await ethers.getContractFactory("VeNewO");
	const RewardNewO = await ethers.getContractFactory("Rewards");
	const XNewO = await ethers.getContractFactory("XNewO");

	/* ==================== Deployment ========================= */

	// Address of the rewards Distributor (NewO treasure)
	const owner = deployer.address;
	const rewardDistributionAddress = deployer.address;

	const gracePeriod = 604800; 	// 7 days (in seconds) 
	const minLock = 7776000;		// 3 months (in seconds)
	const maxLock = 94608000;		// 3 years (in seconds)
	const penaltyPerc = 2;			// 2% penalty per epoch
	const maxPenalty = 15;			// 15% max penalty
	const minPenalty = 5;			// penalty starts at 5%
	const epoch = 86400;			// 1 day (in seconds)

	const veNewo = await VeNewO.deploy(owner, newoAddress, gracePeriod, minLock, maxLock, penaltyPerc, maxPenalty, minPenalty, epoch);
	await veNewo.deployed();
	const rewardNewO = await RewardNewO.deploy(owner, veNewo.address, rewardDistributionAddress, newoAddress);
	await rewardNewO.deployed();
	const xNewoUSDC = await XNewO.deploy(owner, addressLPusdc, newoAddress, veNewo.address, rewardDistributionAddress);
	await xNewoUSDC.deployed();

	console.log("\nveNewo deployed at:", veNewo.address);
	console.log("\nrewardNewO deployed at:", rewardNewO.address);
	console.log("\nxNewoUSDC deployed at:", xNewoUSDC.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
