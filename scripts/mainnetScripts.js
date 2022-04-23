const hre = require("hardhat");

async function main() {

	// Address for the SushiSwap: NEWO-USDC pair
	const liquidityPoolAddress = "0xc08ED9a9ABEAbcC53875787573DC32Eee5E43513";
	// Getting the contract inteface	
	const lp = await ethers.getContractAt("IUniswapV2Pair", liquidityPoolAddress);

	

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
