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
    Rewards,
} from "../typechain";
import { months } from "moment";

const newoTokenAddress = "0x98585dFc8d9e7D48F0b1aE47ce33332CF4237D96";
const TreasuryAddress = "0xdb36b23964FAB32dCa717c99D6AEFC9FB5748f3a";

describe("Rewards tests", async function () {
    let VeNewo: VeNewO__factory;
    let XNewo: XNewO__factory;
    let Rewards: Rewards__factory;
    let newoToken: Contract;

    let veNewo: VeNewO;
    let rewards: Rewards;

    let owner: Signer;
    let addr1: Signer;
    let addr2: Signer;
    let treasury: Signer;

    let ownerAddress: string;
    let treasuryAddress: string;
    let addr1Address: string;

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

        VeNewo = await ethers.getContractFactory("VeNewO");
        Rewards = await ethers.getContractFactory("Rewards");
        XNewo = await ethers.getContractFactory("XNewO");

        newoToken = await ethers.getContractAt(newOrderABI, newoTokenAddress);
        balanceNewo = balance(newoToken);
        parseNewo = await parseToken(newoToken);
        formatNewo = await formatToken(newoToken);

        const signers = await ethers.getSigners();
        owner = signers[0];
        addr1 = signers[1];
        addr2 = signers[2];

        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [TreasuryAddress],
        });

        // Grant more gas to account 
        await hre.network.provider.send("hardhat_setBalance", [
            TreasuryAddress,
            "0xfffffffffffffffffffffffffffffffffffffffffffff"
        ]);

        treasury = await ethers.getSigner(TreasuryAddress);

        ownerAddress = await owner.getAddress();
        addr1Address = await addr1.getAddress();
        treasuryAddress = await treasury.getAddress();

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

        rewards = await Rewards.deploy(
            ownerAddress,
            veNewo.address,
            TreasuryAddress,
            newoTokenAddress
        );
        await rewards.deployed();

        // Transfer some Newo to addr1 so he can spend freelly;
        const numberOfTokens = parseNewo(1000);
        await newoToken
            .connect(treasury)
            .transfer(addr1Address, numberOfTokens);

        // approve the token
        await newoToken
            .connect(addr1)
            .approve(
                address(veNewo),
                ethers.constants.MaxUint256 
            );
    }
    
    describe("Testing getVaultAddress()", () => {
        before(initialize);
        it("getVaultAddress() should return the address of veNewoVault", async () => {
            expect(await rewards
                .getVaultAddress()
            ).to.be.equal(address(veNewo))
        })
    });
    describe("Testing notifyRewardAmount()", () => {
        before(initialize);
        it("notifyRewardAmount() should only called by rewardsDistributor", async () => {
            const numberOfTokens = parseNewo(10000);
        
            await expect(rewards
                .connect(addr1)
                .notifyRewardAmount(numberOfTokens)
            ).to.be.revertedWith("Caller is not RewardsDistribution contract");
        })
        it("notifyRewardAmount() should revert if reward notified is bigger than contract's balance", async () => {
            const tokensToTransfer = parseNewo(10000);
            const tokensToReward = parseNewo(10001);

            await rewards
                .connect(owner)
                .setRewardsDuration(days(20))
            
            await newoToken
                .connect(treasury)
                .transfer(address(rewards), tokensToTransfer)
            
            await expect(rewards
                .connect(treasury)
                .notifyRewardAmount(tokensToReward)
            ).to.be.revertedWith("Provided reward too high");
        })
    });
    describe("Testing rewardsToken()", () => {
        before(initialize);
        it("rewardsToken() should return NEWO address", async () => {
            expect(await rewards
                .rewardsToken()
            ).to.be.equal(address(newoToken))
        })
    });

    async function setReward(rewardAmount: number, distributionPeriod: number) {

        const tokensToReward = parseNewo(rewardAmount);
        
        console.log("\n Setting distribution reward");
        
        await rewards
            .connect(owner)
            .setRewardsDuration(distributionPeriod)

        await newoToken
            .connect(treasury)
            .transfer(address(rewards),tokensToReward);

        await rewards
            .connect(treasury)
            .notifyRewardAmount(tokensToReward);

    }

    async function checkBalances(signer: Signer) {
        const balNewo = await balanceNewo(signer);
        const balVeNewo = await balanceVeNewo(signer);
        console.log("\tBalance report:");
        
        console.log(
            `\tbalance of newo of ${address(signer)}: ${formatNewo(
                balNewo
            )}`
        );
        console.log(
            `\tbalance of veNewo of ${address(signer)}: ${formatVeNewo(
                balVeNewo
            )}`
        );
        return { balNewo, balVeNewo };
    }
});