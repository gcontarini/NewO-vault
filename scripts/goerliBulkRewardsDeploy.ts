import { ethers } from "hardhat";
import hre = require("hardhat");

async function main() {
    const ownerAddress = "0xe7A446fAa71Ced46c45E29b320da0B3690127237";
    const veNewoAddress = "0x59b818dC48b6cbE96548Cec6a65832642685747a";

    /* Rewards tokens addresses */
    const newoTokenAddress = "0xe5EF84BA9Dc859360727A27D13105a72b9023834";
    const windyTokenAddress = "0x668942ba0c90e8ca5193caed8e1b8d86879428c9"
    const daiTokenAddress = "0x11fe4b6ae13d2a6055c8d9cf65c55bac32b5d844"

    // We get the contracts to deploy
    const Rewards = await ethers.getContractFactory("Rewards");
    const RewardsController = await ethers.getContractFactory("RewardsController");

    const newoRewards = await Rewards.deploy(
        ownerAddress,
        veNewoAddress,
        ownerAddress,
        newoTokenAddress
    );
    await newoRewards.deployed();

    console.log("\nNewo Rewards deployed to: ", newoRewards.address);

    const windyRewards = await Rewards.deploy(
        ownerAddress,
        veNewoAddress,
        ownerAddress,
        windyTokenAddress
    );
    await windyRewards.deployed();

    console.log("\nWindy Rewards deployed to: ", windyRewards.address);

    const daiRewards = await Rewards.deploy(
        ownerAddress,
        veNewoAddress,
        ownerAddress,
        daiTokenAddress
    );
    await daiRewards.deployed();

    console.log("\nDAI Rewards deployed to: ", daiRewards.address);

    const controller = await RewardsController.deploy(ownerAddress, veNewoAddress)
    await controller.deployed();

    console.log("\nController deployed to: ", controller.address);

    /* Controller and Rewards setup */

    console.log("\nSetting up controller");

    await controller.bulkAddRewardsContract([newoRewards.address, windyRewards.address, daiRewards.address])

    console.log("\nSetting up rewards");

    await newoRewards.addTrustedController(controller.address);
    await windyRewards.addTrustedController(controller.address);
    await daiRewards.addTrustedController(controller.address);

    let controllerStatus = await controller.rewardTrustableStatus();

    console.log("Controller Status: ", controllerStatus);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});