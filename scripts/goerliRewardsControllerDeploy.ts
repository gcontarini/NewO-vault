import { ethers } from "hardhat";
import hre = require("hardhat");

async function main() {
    const ownerAddress = "0xe7A446fAa71Ced46c45E29b320da0B3690127237";
    const veNewoAddress = "0x59b818dC48b6cbE96548Cec6a65832642685747a";

    // We get the contract to deploy
    const RewardsController = await ethers.getContractFactory("RewardsController");
    const rewardsController = await RewardsController.deploy(
        ownerAddress,
        veNewoAddress,
    );
    await rewardsController.deployed();
  
    console.log("RewardsController deployed", rewardsController.address, ownerAddress, veNewoAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});