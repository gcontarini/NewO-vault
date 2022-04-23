const { ethers } = require("hardhat");
const newOrderABI = require("../abi/NewOrderERC20.js")

async function main() {
	const [deployer] = await ethers.getSigners()

	console.log("address of the deployer", deployer.address);

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

	/* ==================== Testing xNewO vault =================== */

	// impersonate an account that has NewOLP tokens and NewO tokens for testing purposes:
	// https://etherscan.io/address/0x5976fd31391dd442d59af9ed43d37a5394379956
	await hre.network.provider.request({
		method: "hardhat_impersonateAccount",
		params: ["0xc08ED9a9ABEAbcC53875787573DC32Eee5E43513"],
	});
	const signer = await ethers.getSigner("0xc08ED9a9ABEAbcC53875787573DC32Eee5E43513")
	
	// Deposit. It breaks: Error: cannot estimate gas
	// TODO: Import console log into the contracts and debug this shit
	xNewo.connect(signer.address).deposit(0.00502907359557*10**17, signer.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
