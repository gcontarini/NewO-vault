import * as dotenv from "dotenv";
import { expect } from "chai";
import hre = require("hardhat");
import { ethers } from "hardhat";
import { Signer, Contract, BigNumberish, BigNumber } from "ethers";

import newOrderABI from "../abi/NewOrderERC20.json";
import {
    balance,
    parseToken,
    days,
    address,
    years,
    timeTravel,
    formatToken,
    assetBalance,
} from "./utils";
import {
    VeNewO,
    VeNewO__factory,
    XNewO__factory,
    Rewards__factory,
    RewardsController__factory,
    Rewards,
    RewardsController,
} from "../typechain";

const newoTokenAddress = "0x98585dFc8d9e7D48F0b1aE47ce33332CF4237D96";
const TreasuryAddress = "0xdb36b23964FAB32dCa717c99D6AEFC9FB5748f3a";

describe("Rewards tests", async function () {
    let VeNewo: VeNewO__factory;
    let XNewo: XNewO__factory;
    let Rewards: Rewards__factory;
    let newoToken: Contract;
    let RewardsController: RewardsController__factory;

    let veNewo: VeNewO;
    let rewards: Rewards;
    let controller: RewardsController;

    let owner: Signer;
    let addr1: Signer;
    let addr2: Signer;
    let treasury: Signer;

    let ownerAddress: string;
    let treasuryAddress: string;
    let addr1Address: string;

    let declaration: string;

    // Legal NEWO DAO Terms and Conditions
    declaration = "I have read and agree to the Terms and Conditions https://neworder.network/legal"

    // this are functions that returns the balance
    let balanceNewo: (entity: any) => Promise<BigNumberish>;
    let stakeBalanceNewo: (entity: any) => Promise<BigNumberish>;
    let balanceVeNewo: (entity: any) => Promise<BigNumberish>;

    let parseNewo: (input: number) => BigNumberish;
    let parseVeNewo: (input: number) => BigNumberish;

    let formatNewo: (input: BigNumberish) => string;
    let formatVeNewo: (input: BigNumberish) => string;

    const initialize = async () => {
        // reset the block number
        await hre.network.provider.request({
            method: "hardhat_reset",
            params: [
                {
                    forking: {
                        jsonRpcUrl: process.env.ETH_MAINFORK || "",
                        blockNumber: 14670842,
                    },
                },
            ],

        });

        // Get contract's factory
        VeNewo = await ethers.getContractFactory("VeNewO");
        Rewards = await ethers.getContractFactory("Rewards");
        XNewo = await ethers.getContractFactory("XNewO");
        RewardsController = await ethers.getContractFactory("RewardsController");

        // Get contracts factory for already deployed contracts
        newoToken = await ethers.getContractAt(newOrderABI, newoTokenAddress);
        balanceNewo = balance(newoToken);
        parseNewo = await parseToken(newoToken);
        formatNewo = await formatToken(newoToken);

        // Create signers
        const signers = await ethers.getSigners();
        owner = signers[0];
        addr1 = signers[1];
        addr2 = signers[2];

        // Impersonate Treasury
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [TreasuryAddress],
        });

        // Grant more gas to account
        await hre.network.provider.send("hardhat_setBalance", [
            TreasuryAddress,
            "0xfffffffffffffffffffffffffffffffffffffffffffff"
        ]);

        // Get treasury signature
        treasury = await ethers.getSigner(TreasuryAddress);

        // Get Addresses
        ownerAddress = await owner.getAddress();
        addr1Address = await addr1.getAddress();
        treasuryAddress = await treasury.getAddress();

        // veNewo deployement
        veNewo = await VeNewo.deploy(
            ownerAddress,       // address owner_,
            newoTokenAddress,   // address stakingToken_,
            days(7),            // uint256 gracePeriod_,
            days(90),           // uint256 minLockTime_,
            years(3),           // uint256 maxLockTime_,
            2,                  // uint256 penaltyPerc_,
            15,                 // uint256 maxPenalty_,
            5,                  // uint256 minPenalty_,
            86400               // uint256 epoch_
        );
        await veNewo.deployed();
        balanceVeNewo = balance(veNewo);
        stakeBalanceNewo = assetBalance(veNewo);
        parseVeNewo = await parseToken(veNewo);
        formatVeNewo = await formatToken(veNewo);

        // rewards deployement
        rewards = await Rewards.deploy(
            ownerAddress,
            veNewo.address,
            TreasuryAddress,
            newoTokenAddress
        );
        await rewards.deployed();

        controller = await RewardsController.deploy(ownerAddress, veNewo.address);

        // Transfer some Newo to addr1 so he can spend freelly;
        const numberOfTokens = parseNewo(1000);
        await newoToken
            .connect(treasury)
            .transfer(addr1Address, numberOfTokens);

        // approve the token to addr1
        await newoToken
            .connect(addr1)
            .approve(
                address(veNewo),
                ethers.constants.MaxUint256
            );

        // approve the token to addr2
        await newoToken
            .connect(addr2)
            .approve(
                address(veNewo),
                ethers.constants.MaxUint256
            );
    }

    describe("Testing Controller", () => {
        before(initialize);
    });
});