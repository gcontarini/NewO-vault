import { ethers } from "hardhat";
import hre = require("hardhat");

async function main() {
    const ownerAddress = "0x60b4e7742328eF121ff4f5df513ca1d4e3ba2E04";
    const veNewoAddress = "0x52acfD4699C3dbf336a48084bAFC60bDf99A7f19";
    const newoTokenAddress = "0x3597e30D8Fa8F9a9Fd5db8A6FAFE872c8E720B14";
    // We get the contract to deploy
    const Rewards = await ethers.getContractFactory("Rewards");
    const rewards = await Rewards.deploy(
        ownerAddress,
        veNewoAddress,
        ownerAddress,
        newoTokenAddress
    );
    await rewards.deployed();
  
    console.log("Rewards deployed", rewards.address, ownerAddress, veNewoAddress, ownerAddress, newoTokenAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});