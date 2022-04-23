const { ethers } = require("hardhat");
const newOrderABI = require("../abi/NewOrderERC20.js")

async function main() {
	const [deployer] = await ethers.getSigners()

	console.log("address of the deployer", deployer.address);

	// Address for the SushiSwap: NEWO-USDC pair
	const liquidityPoolAddress = "0xc08ED9a9ABEAbcC53875787573DC32Eee5E43513";
	// Address of NEWO token
	const newoAddress = "0x98585dFc8d9e7D48F0b1aE47ce33332CF4237D96";
	// Address of the rewardDistribution contract (this one is fake, we still have to implement and deploy to test it right)
	const rewardDistributionAddress = deployer.address;

	// Create and instance of the liquidity pool contract
	const lp = await ethers.getContractAt("IUniswapV2Pair", liquidityPoolAddress);
	// Create an instance of the NewO ERC20
	const newoToken = await ethers.getContractAt(newOrderABI, newoAddress);

	// examples for calling the contracts:
	const example = await lp.getReserves();
	const newoSupply = await newoToken.totalSupply()
	console.log("Examples:", example, newoSupply);

	/* ============ Get Factory of contracts to deploy ========= */
	const VeNewO = await ethers.getContractFactory("VeNewO");
	const XNewO = await ethers.getContractFactory("XNewO");

	/* ==================== Deployment ========================= */
	const veNewo = await VeNewO.deploy(deployer.address, newoAddress, 604800, 7776000, 94608000, 2, 15, 5, 86400);
	await veNewo.deployed();
	const xNewo = await XNewO.deploy(deployer.address, liquidityPoolAddress, newoAddress, veNewo.address, rewardDistributionAddress);
	await xNewo.deployed();

	console.log("veNewo deployed at:", veNewo.address, "\n", "xNewo deployed at:", xNewo.address);
	

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
