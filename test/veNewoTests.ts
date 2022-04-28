import * as dotenv from "dotenv";
import { expect } from "chai";
import { ethers } from "hardhat";
import hre = require("hardhat");
import {
    VeNewO,
    VeNewO__factory,
    XNewO__factory,
    Rewards__factory,
    Rewards,
} from "../typechain";
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
} from "./utils";

const newoTokenAddress = "0x98585dFc8d9e7D48F0b1aE47ce33332CF4237D96";
const TreasuryAddress = "0xdb36b23964FAB32dCa717c99D6AEFC9FB5748f3a";

describe("veNewo tests", function () {
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

        // Grant more gas to this sucker
        await hre.network.provider.send("hardhat_setBalance", [
            TreasuryAddress,
            "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        ]);

        treasury = await ethers.getSigner(TreasuryAddress);

        ownerAddress = await owner.getAddress();
        addr1Address = await addr1.getAddress();
        treasuryAddress = await treasury.getAddress();

        veNewo = await VeNewo.deploy(
            ownerAddress, // address owner_,
            newoTokenAddress, // address stakingToken_,
            days(7), // uint256 gracePeriod_,
            days(90), // uint256 minLockTime_,
            years(3), // uint256 maxLockTime_,
            2, // uint256 penaltyPerc_,
            15, // uint256 maxPenalty_,
            5, // uint256 minPenalty_,
            86400 // uint256 epoch_
        );
        await veNewo.deployed();
        balanceVeNewo = balance(veNewo);
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
                "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
            );
    };

    /* impossible cases */
    describe("Deposit it for 30 days", () => {
        before(initialize);
        it("the depositor can't lock it for 30 days", async () => {
            await expect(
                veNewo
                    .connect(addr1)
                    ["deposit(uint256,address,uint256)"](
                        parseNewo(1000),
                        address(addr1),
                        days(30)
                    )
            ).to.be.revertedWith("Lock time is less than min.");
        });
    });

    describe("Deposit it for 4 years", () => {
        before(initialize);
        it("the depositor can't lock it for 4 years", async () => {
            await expect(
                veNewo
                    .connect(addr1)
                    ["deposit(uint256,address,uint256)"](
                        parseNewo(1000),
                        address(addr1),
                        years(4)
                    )
            ).to.be.revertedWith("Lock time is more than max.");
        });
    });

    /* possible cases */
    testLock(days(90), days(30), 100);
    testLock(years(3), days(30), 100);
    testKickUser(days(90), days(30), 100);
    testKickUser(years(3), days(30), 100);

    /**
     * test locking cases
     * @param totalLockPeriod the lock period
     * @param initialWaitPeriod this function will try to exit after the initial wait period, expecting it to fail
     * @param depositAmount the amount to deposit in plain number
     */
    function testLock(
        totalLockPeriod: number,
        initialWaitPeriod: number,
        depositAmount: number
    ) {
        const numDays = Math.round(totalLockPeriod / 86400);
        const restOfThePeriod = totalLockPeriod - initialWaitPeriod;

        describe(`Locking it for ${numDays} days`, () => {
            before(initialize);

            it("the depositor should not be able to unlock if the deadline is not over", async () => {
                await userDeposit(totalLockPeriod, parseNewo(depositAmount));

                // time travel
                await timeTravel(initialWaitPeriod);

                await expect(
                    veNewo
                        .connect(addr1)
                        .withdraw(
                            parseNewo(depositAmount),
                            address(addr1),
                            address(addr1)
                        )
                ).to.be.revertedWith("Funds not unlocked yet.");
            });
            it("the depositor should be able to exit the asset after unlock day", async () => {
                await timeTravel(restOfThePeriod);
                const { balNewo: balNewoBefore } = await checkBalances(addr1);

                // TODO: claim the rewards
                // await rewards.getReward();
                console.log("exiting");
                await veNewo.connect(addr1).exit();

                const { balNewo: balNewoAfter } = await checkBalances(addr1);

                expect((balNewoAfter as BigNumber).sub(balNewoBefore)).to.gte(
                    parseNewo(depositAmount)
                );
            });
        });
    }

    /**
     * test lock and kick user cases
     * @param totalLockPeriod the lock period
     * @param initialWaitPeriod this function will try to exit after the initial wait period, expecting it to fail
     * @param depositAmount the amount to deposit in plain number
     */
    function testKickUser(
        totalLockPeriod: number,
        initialWaitPeriod: number,
        depositAmount: number
    ) {
        const numDays = Math.round(totalLockPeriod / 86400);
        const restOfThePeriod = totalLockPeriod - initialWaitPeriod;
        describe(`Locking it for ${numDays} days and the other user try to kick the original user`, () => {
            before(initialize);

            it("other user should not be able to kick out the user when the lock period is not finished", async () => {
                await userDeposit(totalLockPeriod, parseNewo(depositAmount));

                // time travel
                await timeTravel(initialWaitPeriod);

                // this will be reverted with underflow / overflow
                await expect(
                    veNewo
                        .connect(addr2)
                        .withdraw(
                            parseNewo(depositAmount),
                            address(addr1),
                            address(addr1)
                        )
                ).to.be.revertedWith(
                    "reverted with panic code 0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)"
                );
            });

            it("other user should be not able to kick out the user within the grace period", async () => {
                await timeTravel(restOfThePeriod + days(3));

                // exit
                console.log("addr2 try to withdraw for addr1");
                await expect(
                    veNewo
                        .connect(addr2)
                        .withdraw(
                            parseNewo(depositAmount),
                            address(addr1),
                            address(addr1)
                        )
                ).to.be.revertedWith("Funds in grace period.");
            });

            it("other user should be able to kick out the user after the grace period", async () => {
                await timeTravel(days(4));
                const { balNewo: balNewoBefore } = await checkBalances(addr1);
                const { balNewo: balNewoAddr2Before } = await checkBalances(
                    addr2
                );

                // exit
                console.log("addr2 try to withdraw for addr1");
                await veNewo
                    .connect(addr2)
                    .withdraw(
                        parseNewo(depositAmount),
                        address(addr1),
                        address(addr1)
                    );

                const { balNewo: balNewoAfter } = await checkBalances(addr1);
                const { balNewo: balNewoAddr2After } = await checkBalances(
                    addr2
                );
                expect((balNewoAfter as BigNumber).sub(balNewoBefore)).to.gte(
                    parseNewo(depositAmount * (1 - 0.05))
                );
                expect(balNewoAddr2After).to.gt(balNewoAddr2Before);
            });
        });
    }

    async function userDeposit(totalLockPeriod: number, amount: BigNumberish) {
        const { balNewo: balNewoBefore } = await checkBalances(addr1);

        // deposit
        console.log("depositing");
        await veNewo
            .connect(addr1)
            ["deposit(uint256,address,uint256)"](
                amount,
                address(addr1),
                totalLockPeriod
            );

        const { balNewo: balNewoAfter } = await checkBalances(addr1);
        expect((balNewoBefore as BigNumber).sub(balNewoAfter)).to.gte(amount);
    }

    async function checkBalances(signer: Signer) {
        const balNewo = await balanceNewo(signer);
        const balVeNewo = await balanceVeNewo(signer);
        console.log(
            `balance of newo of ${address(signer)}: ${formatNewo(balNewo)}`
        );
        console.log(
            `balance of veNewo of ${address(signer)}: ${formatVeNewo(
                balVeNewo
            )}`
        );
        return { balNewo, balVeNewo };
    }
});
