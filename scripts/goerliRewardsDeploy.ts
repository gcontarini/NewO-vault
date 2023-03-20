import { ethers } from "hardhat";
import hre = require("hardhat");

async function main() {
    const ownerAddress = "";
    const veNewoAddress = "0x59b818dC48b6cbE96548Cec6a65832642685747a";
    const rewardsTokenAddress = "0xe5EF84BA9Dc859360727A27D13105a72b9023834";

    // We get the contract to deploy
    const Rewards = await ethers.getContractFactory("Rewards");
    const rewards = await Rewards.deploy(
        ownerAddress,
        veNewoAddress,
        ownerAddress,
        rewardsTokenAddress
    );
    await rewards.deployed();
  
    console.log("Rewards deployed", rewards.address, ownerAddress, veNewoAddress, ownerAddress, rewardsTokenAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});