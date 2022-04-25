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
	// Address of the rewardDistribution contract (this one is fake, we still have to implement and deploy to test it right)
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

	/* ==================== Testing xNewO vault =================== */
	const testAccount = "0xdb36b23964FAB32dCa717c99D6AEFC9FB5748f3a";

	// Impersonate an account that has NewOLP tokens and NewO tokens
	// https://etherscan.io/address/0xdb36b23964FAB32dCa717c99D6AEFC9FB5748f3a
	await hre.network.provider.request({
		method: "hardhat_impersonateAccount",
		params: [testAccount],
	});
	// Grant more gas to this sucker
	await hre.network.provider.send("hardhat_setBalance", [
		testAccount,
		"0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
	  ]);

	const txOpt2 = {
		gasPrice: baseFee,
		gasLimit: "0xf21620" // hardcoding a gas limit to work
	};

	const signer = await ethers.getSigner(testAccount);

	// Transfer NewO to Rewards Contract
	const numberOfTokens = ethers.utils.parseUnits('1.0', 18);
	await newoToken.connect(signer).transfer(rewardNewO.address, numberOfTokens);
	
	// Notify Reward amount (the caller must be rewardDistribution)
	await rewardNewO.connect(deployer).notifyRewardAmount(numberOfTokens);

	// Lock nwo for veNwo
	const newoAmount = await newoToken.balanceOf(signer.address);
	await newoToken.connect(signer).approve(veNewo.address, newoAmount, txOpt2);
	
	const years3 = 94608000;
	const veLockTx = await veNewo.connect(signer)["deposit(uint256,address,uint256)"](newoAmount, signer.address, years3, txOpt2);
	console.log("\nveLock tx: ", veLockTx.hash);
	console.log("\nveBalance:", await veNewo.balanceOf(signer.address));
	
	// Notify reward contract about deposit
	await rewardNewO.connect(signer).notifyDeposit(txOpt2); // Check what is going wrong about it.

	// Calculat how much LP tokens it can stake
	const depositAmount = await lp.balanceOf(testAccount);
	console.log("\nLP balance:", depositAmount);

	// Make allowance for LP tokens
	const LpAllowance = await lp.connect(signer).approve(xNewo.address, depositAmount, txOpt2);
	// Stake LP to get xNewO
	const txLpDeposit = await xNewo.connect(signer).deposit(depositAmount, signer.address, txOpt2);
	console.log("\nStake LP tx:", txLpDeposit.hash);
	console.log("\nLp staked balance: ", await xNewo.assetBalanceOf(signer.address))
	console.log("\nxNewO balance:", await xNewo.balanceOf(signer.address));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
