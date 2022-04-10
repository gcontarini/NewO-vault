// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers } from "hardhat";

async function main() {
  // We get the contract to deploy
  const NewOrderERC20 = await ethers.getContractFactory("NewOrderToken");
  const newo = await NewOrderERC20.deploy(1000);
  

  await newo.deployed();

  console.log("NewO Token deployed", newo.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
