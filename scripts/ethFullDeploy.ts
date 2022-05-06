// const { ethers } = require("hardhat");
import hre = require("hardhat");
import { ethers } from "hardhat";


import newOrderABI from "../abi/NewOrderERC20.json";

async function main() {
	const [deployer] = await ethers.getSigners()
	console.log("Deployer:", deployer.address);

	// Address for the SushiSwap: NEWO-USDC pair
	const liquidityPoolAddress = "0xc08ED9a9ABEAbcC53875787573DC32Eee5E43513";
	// Address of the NEWO token
	const newoAddress = "0x98585dFc8d9e7D48F0b1aE47ce33332CF4237D96";
	// Address of the rewards Distributor (NewO treasure)
	const rewardDistributionAddress = deployer.address;

	// Create an instance of the liquidity pool contract
	const lp = await ethers.getContractAt("IUniswapV2Pair", liquidityPoolAddress);
	// Create an instance of the NewO ERC20
	const newoToken = await ethers.getContractAt(newOrderABI, newoAddress);

	/* ============ Get Factory of contracts to deploy ========= */
	
	const VeNewO = await ethers.getContractFactory("VeNewO");
	const RewardNewO = await ethers.getContractFactory("Rewards");
	const XNewO = await ethers.getContractFactory("XNewO");

	/* ==================== Deployment ========================= */
	
	// Get base fee for next block
	const baseFee = await hre.network.provider.send("eth_gasPrice");
	console.log("\n\nThe next block gasPrice is:", baseFee);
	// Add all other necessary transaction options
	const txOpt1 = {
		gasPrice: baseFee,
	};

	const veNewo = await VeNewO.deploy(deployer.address, newoAddress, 604800, 7776000, 94608000, 2, 15, 5, 86400, txOpt1);
	await veNewo.deployed();
	const rewardNewO = await RewardNewO.deploy(deployer.address, veNewo.address, rewardDistributionAddress, newoAddress, txOpt1);
	await rewardNewO.deployed();
	const xNewo = await XNewO.deploy(deployer.address, lp.address, newoAddress, veNewo.address, rewardDistributionAddress, txOpt1);
	await xNewo.deployed();

	console.log("\nveNewo deployed at:", veNewo.address);
	console.log("\nrewardNewO deployed at:", rewardNewO.address);
	console.log("\nxNewo deployed at:", xNewo.address)

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
