const { ethers } = require("hardhat");
const newOrderABI = require("../abi/NewOrderERC20.js")

async function main() {
	const [deployer] = await ethers.getSigners()
	let deployerAddress = deployer.address

	console.log("address of the deployer", deployerAddress);

	// Address for the SushiSwap: NEWO-USDC pair
	const liquidityPoolAddress = "0xc08ED9a9ABEAbcC53875787573DC32Eee5E43513";
	// Address of NEWO token
	const newoAddress = "0x98585dFc8d9e7D48F0b1aE47ce33332CF4237D96";

	// Create and instance of liquidity pool
	const lp = await ethers.getContractAt("IUniswapV2Pair", liquidityPoolAddress);
	// Create an instance of the NewO ERC20
	const newoToken = await ethers.getContractAt(newOrderABI, newoAddress)

	
	
	const test = await newoToken.totalSupply()
	console.log(test.toString());

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
