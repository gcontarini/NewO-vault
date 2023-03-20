import { ethers } from "hardhat";
import hre = require("hardhat");

async function main() {
    const ownerAddress = "";
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