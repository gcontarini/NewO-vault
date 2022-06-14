import { ethers } from "hardhat";
import hre = require("hardhat");

async function main() {
    const ownerAddress = "0x60b4e7742328eF121ff4f5df513ca1d4e3ba2E04";
    const veNewoAddress = "0x83655F0489b3469ab5299e14Bd2D726A19FEf553"
    const newoTokenAddress = "0x3597e30D8Fa8F9a9Fd5db8A6FAFE872c8E720B14";
    const lpAddress = "0x514878165a3b276ee3F27Fd09A28a6B356E1DB15";
    // We get the contract to deploy
    const XNewo = await ethers.getContractFactory("XNewO");
    const xNewo = await XNewo.deploy(
        ownerAddress,
        lpAddress,
        newoTokenAddress,
        veNewoAddress,
        ownerAddress,
    );
    await xNewo.deployed();
    console.log("xNewo deployed", xNewo.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});