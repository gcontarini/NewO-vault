import { ethers } from "hardhat";
import hre = require("hardhat");
import {
  days,
  years,
} from "../test/utils";

async function main() {
    const ownerAddress = "0x60b4e7742328eF121ff4f5df513ca1d4e3ba2E04";
    const newoTokenAddress = "0x3597e30D8Fa8F9a9Fd5db8A6FAFE872c8E720B14";
    
    // We get the contract to deploy
    const VeNewo = await ethers.getContractFactory("VeNewO");
    const veNewo = await VeNewo.deploy(
        ownerAddress,       // address owner_,
        newoTokenAddress,   // address stakingToken_,
        days(7),            // uint256 gracePeriod_,
        days(90),           // uint256 minLockTime_,
        years(3),           // uint256 maxLockTime_,
        2,                  // uint256 penaltyPerc_,
        15,                 // uint256 maxPenalty_,
        5,                  // uint256 minPenalty_,
        days(1)               // uint256 epoch_
    );
  
    await veNewo.deployed();
  
    console.log("veNewo deployed", veNewo.address, days(7), days(90), years(3), 2, 15, 5, days(1));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});