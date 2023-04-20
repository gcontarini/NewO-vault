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
    let signatureAddr1: string;
    let signatureAddr2: string;

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

        // Legal NEWO DAO Terms and Conditions
        declaration = "I have read and agree to the Terms and Conditions https://neworder.network/legal"
        let hashedDeclaration = ethers.utils.solidityKeccak256(["string"], [declaration])
        signatureAddr1 = await addr1.signMessage(ethers.utils.arrayify(hashedDeclaration));
        signatureAddr2 = await addr2.signMessage(ethers.utils.arrayify(hashedDeclaration));

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

    // Testing view functions
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
            ).to.be.revertedWith("OnlyRewardsDistribution()");
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
            ).to.be.revertedWith("RewardTooHigh()");
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
    describe("Testing setRewardsDuration()", () => {
        before(initialize);
        it("setRewardsDuration() should only be called by owner", async () => {
            await expect(rewards
                .connect(addr1)
                .setRewardsDuration(days(20))
            ).to.be.revertedWith("NotOwner()")
        })
        it("setRewardsDuration() should set the right duration", async () => {
            await rewards
                .connect(owner)
                .setRewardsDuration(days(20))

            expect(await rewards
                .rewardsDuration()
            ).to.be.equal(days(20));
        })
    })
    describe("Integrated tests", () => {
        before(initialize)
        it("Rewards should be distributed based on veNewo balance of address", async () => {
            await setReward(10000, years(2));

            await newoToken.connect(treasury).transfer(address(addr2), parseNewo(1000));

            const { balNewo: balNewoAddr1Before } = await checkBalances(addr1);
            const { balNewo: balNewoAddr2Before } = await checkBalances(addr2);

            expect(balNewoAddr1Before).to.be.equal(balNewoAddr2Before);

            await veNewo
                .connect(addr1)
            ["deposit(uint256,address,uint256)"](
                balNewoAddr1Before,
                address(addr1),
                years(2)
            )

            await controller.connect(owner).addRewardsContract(address(rewards))

            await rewards.connect(owner).addTrustedController(address(controller))

            await controller.connect(addr1).notifyAllDeposit(signatureAddr1)

            // await rewards.connect(addr1).notifyDeposit(address(addr1));

            await veNewo.connect(addr2)
            ["deposit(uint256,address,uint256)"](
                balNewoAddr2Before,
                address(addr2),
                days(90)
            )

            await controller.connect(addr2).notifyAllDeposit(signatureAddr2)

            const { balVeNewo: balVeNewoAddr1 } = await checkBalances(addr1);
            const { balVeNewo: balVeNewoAddr2 } = await checkBalances(addr2);

            expect(balVeNewoAddr1).to.gt(balVeNewoAddr2)

            await timeTravel(years(3));

            await controller.connect(addr1).getAllRewards(signatureAddr1)

            await controller.connect(addr2).getAllRewards(signatureAddr2)

            const { balNewo: balNewoAddr1After } = await checkBalances(addr1);
            const { balNewo: balNewoAddr2After } = await checkBalances(addr2);

            expect(balNewoAddr1After).to.gt(balNewoAddr2After)
        })
    })

    describe("Integrated tests", () => {
        before(initialize)
        it("Rewards should be distributed based on veNewo with right multipler", async () => {
            const rewardAmount = 1000000;
            const upperBound = (parseNewo(rewardAmount) as BigNumber).mul(10001).div(10000);
            await setReward(rewardAmount, days(90));

            await newoToken.connect(treasury).transfer(address(addr2), parseNewo(1000));

            const { balNewo: balNewoAddr1Before } = await checkBalances(addr1);
            const { balNewo: balNewoAddr2Before } = await checkBalances(addr2);

            expect(balNewoAddr1Before).to.be.equal(balNewoAddr2Before);

            await veNewo
                .connect(addr1)
            ["deposit(uint256,address,uint256)"](
                balNewoAddr1Before,
                address(addr1),
                years(2)
            )

            await controller.connect(owner).addRewardsContract(address(rewards))

            await rewards.connect(owner).addTrustedController(address(controller))

            expect(await rewards.connect(owner).getDueDate(address(addr1))).to.be.equal(0)

            await controller.connect(addr1).notifyAllDeposit(signatureAddr1)

            let dueDate = await rewards.connect(addr1).getDueDate(address(addr1))

            let unlockDate = await veNewo.connect(addr1).unlockDate(address(addr1))

            expect(dueDate).to.be.equal(unlockDate)

            await veNewo.connect(addr2)
            ["deposit(uint256,address,uint256)"](
                balNewoAddr2Before,
                address(addr2),
                days(90)
            )

            await controller.connect(addr2).notifyAllDeposit(signatureAddr2)

            const { balVeNewo: balVeNewoAddr1 } = await checkBalances(addr1);
            const { balVeNewo: balVeNewoAddr2 } = await checkBalances(addr2);

            expect(balVeNewoAddr1).to.gt(balVeNewoAddr2)

            await timeTravel(days(90));

            await controller.connect(addr1).getAllRewards(signatureAddr1)

            await controller.connect(addr2).getAllRewards(signatureAddr2)

            const { balNewo: balNewoAddr1After } = await checkBalances(addr1);
            const { balNewo: balNewoAddr2After } = await checkBalances(addr2);

            const bonus = (balNewoAddr1After as BigNumber).mul("1000000000000000000").div(balNewoAddr2After);
            const addr1Mult = (balVeNewoAddr1 as BigNumber).mul("1000000000000000000").div(balNewoAddr1Before);

            console.log("\nmultiplier of addr1", addr1Mult);

            const newoTokensInContract = await newoToken.balanceOf(address(rewards));
            console.log("\n\n still in contract", formatNewo(newoTokensInContract));

            expect(bonus).to.be.gte(addr1Mult.mul(999).div(1000)).and.lte(addr1Mult.mul(1001).div(1000));

            console.log("addr1 bonus compared to addr2", bonus);

            expect(balNewoAddr1After).to.gt(balNewoAddr2After);

            expect(newoTokensInContract).to.be.lte(upperBound);
        })
    })

    describe("Testing Trustable", () => {
        before(initialize);
        it("addTrustedController should only be call by owner, should not allow adding an existing trusted controller", async function () {
            await expect(rewards.connect(addr1).addTrustedController(address(controller))).to.be.revertedWith("NotOwner()");

            await rewards.connect(owner).addTrustedController(address(controller));

            await rewards.trustedControllers(address(controller));

            await expect(rewards.connect(owner).addTrustedController(address(controller))).to.be.revertedWith("AlreadyTrustedController");
        });

        it("removeTrustedController should only be call by owner, should not allow removing a non-existent trusted controller", async function () {
            await expect(rewards.connect(addr1).removeTrustedController(address(controller))).to.be.reverted;

            await rewards.connect(owner).removeTrustedController(address(controller));
            expect(await rewards.trustedControllers(address(controller))).to.be.false;

            await expect(rewards.connect(owner).removeTrustedController(address(controller))).to.be.revertedWith("NotTrustedController");
        });

        it("should not allow non-trusted controller to call function", async function () {
            await controller.connect(owner).addRewardsContract(address(rewards));
            await expect(controller.connect(addr1).notifyAllDeposit(signatureAddr1)).to.be.revertedWith("NotTrustedController");
        });

        it("should allow trusted controller to call function", async function () {
            await rewards.connect(owner).addTrustedController(address(controller));

            await newoToken.connect(treasury).transfer(address(addr2), parseNewo(1000));

            await veNewo
                .connect(addr1)
            ["deposit(uint256,address,uint256)"](
                parseNewo(1000),
                address(addr1),
                years(2)
            )

            await controller.connect(addr1).notifyAllDeposit(signatureAddr1);
        });
    });

    describe("Testing isRegistered with notifying after restaking", () => {
        before(initialize);

        const rewardAmount = 3000000;

        it("should return false if not registered", async function () {
            expect(await rewards.isRegistered(address(addr1))).to.be.false;
        });

        it("should return true if registered", async function () {
            await setReward(rewardAmount / 3, days(180));

            await newoToken.connect(treasury).transfer(address(addr1), parseNewo(1000));

            await veNewo
                .connect(addr1)
            ["deposit(uint256,address,uint256)"](
                parseNewo(1000),
                address(addr1),
                days(180)
            )

            await rewards.connect(owner).addTrustedController(address(controller));

            await controller.connect(owner).addRewardsContract(address(rewards));

            await controller.connect(addr1).notifyAllDeposit(signatureAddr1);

            expect(await rewards.isRegistered(address(addr1))).to.be.true;
        });

        it("should receive right amount after restaking with notifying", async function () {
            await timeTravel(days(90));

            const { balNewo: balNewoAddr1Before } = await checkBalances(addr1);
            const { balVeNewo: balVeNewoAddr1Before } = await checkBalances(addr1);

            await newoToken.connect(treasury).transfer(address(addr1), parseNewo(1000));

            await veNewo
                .connect(addr1)
            ["deposit(uint256,address,uint256)"](
                parseNewo(1000),
                address(addr1),
                days(90)
            )

            await controller.connect(addr1).notifyAllDeposit(signatureAddr1);

            expect(await rewards.isRegistered(address(addr1))).to.be.true;

            await timeTravel(days(90));

            await controller.connect(addr1).getAllRewards(signatureAddr1);

            const { balNewo: balNewoAddr1After } = await checkBalances(addr1);
            const { balVeNewo: balVeNewoAddr1After } = await checkBalances(addr1);

            expect(balNewoAddr1After).to.be.gt(balNewoAddr1Before);
            expect(balVeNewoAddr1After).to.be.gt(balVeNewoAddr1Before);
        });
    });

    describe("Testing isRegistered without notifying after restaking", () => {
        before(initialize);

        const rewardAmount = 3000000;

        it("should return false if not registered", async function () {
            expect(await rewards.isRegistered(address(addr1))).to.be.false;
        });

        it("should return true if registered", async function () {
            await setReward(rewardAmount / 3, days(180));

            await newoToken.connect(treasury).transfer(address(addr1), parseNewo(1000));

            await veNewo
                .connect(addr1)
            ["deposit(uint256,address,uint256)"](
                parseNewo(1000),
                address(addr1),
                days(180)
            )

            await rewards.connect(owner).addTrustedController(address(controller));

            await controller.connect(owner).addRewardsContract(address(rewards));

            await controller.connect(addr1).notifyAllDeposit(signatureAddr1);

            expect(await rewards.isRegistered(address(addr1))).to.be.true;
        });

        it("should receive right amount after restaking without notifying", async function () {
            await timeTravel(days(90));

            const { balNewo: balNewoAddr1Before } = await checkBalances(addr1);
            const { balVeNewo: balVeNewoAddr1Before } = await checkBalances(addr1);

            await newoToken.connect(treasury).transfer(address(addr1), parseNewo(1000));

            await veNewo
                .connect(addr1)
            ["deposit(uint256,address,uint256)"](
                parseNewo(1000),
                address(addr1),
                days(90)
            )

            expect(await rewards.isRegistered(address(addr1))).to.be.false;

            await timeTravel(days(90));

            await controller.connect(addr1).getAllRewards(signatureAddr1);

            const { balNewo: balNewoAddr1After } = await checkBalances(addr1);
            const { balVeNewo: balVeNewoAddr1After } = await checkBalances(addr1);

            expect(balNewoAddr1After).to.be.gt(balNewoAddr1Before);
            expect(balVeNewoAddr1After).to.be.gt(balVeNewoAddr1Before);
        });
    });

    async function setReward(rewardAmount: number, distributionPeriod: number) {

        const tokensToReward = parseNewo(rewardAmount);

        console.log("\n Setting distribution reward");

        await rewards
            .connect(owner)
            .setRewardsDuration(distributionPeriod)

        await newoToken
            .connect(treasury)
            .transfer(address(rewards), tokensToReward);

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