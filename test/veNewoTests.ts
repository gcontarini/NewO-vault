import * as dotenv from "dotenv";
import { expect } from "chai";
import hre = require("hardhat");
import { ethers } from "hardhat";
import { Signer, Contract, BigNumberish, BigNumber } from "ethers";

import newOrderABI from "../abi/NewOrderERC20.json";
import USDCABI from "../abi/USDC.json";

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
const USDCAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const WhaleAddress = "0x1B7BAa734C00298b9429b518D621753Bb0f6efF2";

describe("veNewo tests", async function () {
    let VeNewo: VeNewO__factory;
    let XNewo: XNewO__factory;
    let Rewards: Rewards__factory;
    let newoToken: Contract;
    let USDC: Contract;

    let veNewo: VeNewO;
    let rewards: Rewards;

    let owner: Signer;
    let addr1: Signer;
    let addr2: Signer;
    let treasury: Signer;
    let whale: Signer;

    let ownerAddress: string;
    let treasuryAddress: string;
    let addr1Address: string;

    // this are functions that returns the balance
    let balanceNewo: (entity: any) => Promise<BigNumberish>;
    let stakeBalanceNewo: (entity: any) => Promise<BigNumberish>;
    let balanceVeNewo: (entity: any) => Promise<BigNumberish>;
    let balanceUSDC: (entity: any) => Promise<BigNumberish>;

    let parseNewo: (input: number) => BigNumberish;
    let parseVeNewo: (input: number) => BigNumberish;
    let parseUSDC: (input: number) => BigNumberish;

    let formatNewo: (input: BigNumberish) => string;
    let formatVeNewo: (input: BigNumberish) => string;
    let formatUSDC: (input: BigNumberish) => string;

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

        USDC = await ethers.getContractAt(USDCABI, USDCAddress)
        balanceUSDC = balance(USDC);
        parseUSDC = await parseToken(USDC);
        formatUSDC = await formatToken(USDC);

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

        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [WhaleAddress],
        });

        await hre.network.provider.send("hardhat_setBalance", [
            WhaleAddress,
            "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        ]);

        whale = await ethers.getSigner(WhaleAddress)

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
    };

    describe("Test view functions for simplest case.", async () => {        
        before(initialize);
        it("asset equal to token address", async () => {
            const tokenAddr = await veNewo.asset();

            expect(tokenAddr).to.equal(newoTokenAddress);
        });
        it("totalAssets equal to zero", async () => {
            const total = await veNewo.totalAssets();

            expect(total).to.equal(0);
        });
        it("totalSupply equal to zero", async () => {
            const total = await veNewo.totalSupply();

            expect(total).to.equal(0);
        });
        it("balanceOf equal to zero", async () => {
            const total = await veNewo.balanceOf(await addr1.getAddress());

            expect(total).to.equal(0);
        });
        it("convertToShares equal to zero", async () => {
            const total = await veNewo["convertToShares(uint256)"](0);

            expect(total).to.equal(0);
        });
        it("convertToShares with time equal to zero", async () => {
            const total = await veNewo["convertToShares(uint256,uint256)"](0, 0);

            expect(total).to.equal(0);
        });
        it("convertToAssets equal to zero", async () => {
            const total = await veNewo["convertToAssets(uint256)"](0);

            expect(total).to.equal(0);
        });
        it("convertToAssets with time equal to zero", async () => {
            const total = await veNewo["convertToAssets(uint256,uint256)"](0, 0);

            expect(total).to.equal(0);
        });
        it("maxDeposit returns max uint256", async () => {
            const total = await veNewo.maxDeposit(await addr1.getAddress());
            
            expect(total).to.equal(ethers.constants.MaxUint256);
        });
        it("previewDeposit with zero assets", async () => {
            const total = await veNewo["previewDeposit(uint256)"](0);
            
            expect(total).to.equal(0);
        });
        it("previewDeposit with zero assets and zero time", async () => {
            const total = await veNewo["previewDeposit(uint256,uint256)"](0, 0);
            
            expect(total).to.equal(0);
        });
        it("maxMint returns max uint256", async () => {
            const total = await veNewo.maxMint(await addr1.getAddress());
            
            expect(total).to.equal(ethers.constants.MaxUint256);
        });
        it("previewMint with zero shares", async () => {
            const total = await veNewo["previewMint(uint256)"](0);
            
            expect(total).to.equal(0);
        });
        it("previewMint with zero shares and zero time", async () => {
            const total = await veNewo["previewMint(uint256,uint256)"](0, 0);
            
            expect(total).to.equal(0);
        });
        it("maxWithdraw with zero balance", async () => {
            const total = await veNewo.maxWithdraw(await addr1.getAddress());
            
            expect(total).to.equal(0);
        });
        it("maxRedeem with zero balance", async () => {
            const total = await veNewo.maxRedeem(await addr1.getAddress());
            
            expect(total).to.equal(0);
        });
        it("previewRedeem with zero shares", async () => {
            const total = await veNewo["previewRedeem(uint256)"](0);
            
            expect(total).to.equal(0);
        });
        it("previewRedeem with zero shares and zero time", async () => {
            const total = await veNewo["previewRedeem(uint256,uint256)"](0, 0);
            
            expect(total).to.equal(0);
        });
        it("assetBalanceOf with zero assets", async () => {
            const total = await veNewo.assetBalanceOf(await addr1.getAddress());
            
            expect(total).to.equal(0);
        });
        it("allowance always equal to zero", async () => {
            const total = await veNewo.allowance(await addr1.getAddress(), await addr2.getAddress());
            
            expect(total).to.equal(0);
        });
        it("unlockDate with zero assets", async () => {
            const total = await veNewo.unlockDate(await addr1.getAddress());
            
            expect(total).to.equal(0);
        });
        it("gracePeriod setted in deployment", async () => {
            const total = await veNewo.gracePeriod();
            
            expect(total).to.equal(days(7));
        });
        it("penaltyPercentage setted in deployment", async () => {
            const total = await veNewo.penaltyPercentage();
            
            expect(total).to.equal(2);
        });
        it("minLock setted in deployment", async () => {
            const total = await veNewo.minLockTime();
            
            expect(total).to.equal(days(90));
        });
        it("maxLock setted in deployment", async () => {
            const total = await veNewo.maxLockTime();
            
            expect(total).to.equal(years(3));
        });
    })
    
    /* Not allowed ERC20 transfers */
    describe("Test ERC20 transfer functions", async () => {        
       before(initialize);
        it("revert for transfer", async () => {
            await expect(
                veNewo.transfer(await addr1.getAddress(), 1000)
                ).to.be.reverted;
        });
        it("revert for approve", async () => {
            await expect(
                veNewo.approve(await addr1.getAddress(), 1000)
                ).to.be.reverted;
        });
        it("revert for transferFrom", async () => {
            await expect(
                veNewo.transferFrom(await addr1.getAddress(), await addr2.getAddress(), 1000)
                ).to.be.reverted;
        });
    });

    /* numerical return of ve multipler */
    describe("Test veMult numerical value", async () => {        
       before(initialize);
        it("convertToShares 3 months return multiplier equal 1", async () => {
            expect(
                await veNewo["convertToShares(uint256,uint256)"](100, days(90))
                ).to.be.equal(100);
        });
        it("convertToShares without time returns min multipler", async () => {
            expect(
                await veNewo["convertToShares(uint256)"](100)
                ).to.be.equal(100);
        });
        it("convertToShares 2 years return multiplier equal 1.95", async () => {
            expect(
                await veNewo["convertToShares(uint256,uint256)"](100, years(2))
                ).to.be.equal(195);
        });
        it("convertToShares 9 months return multiplier equal 1.19", async () => {
            expect(
                await veNewo["convertToShares(uint256,uint256)"](100, days(30 * 9))
                ).to.be.equal(119);
        });
        it("convertToShares 3 years return multiplier equal 3.3", async () => {
            expect(
                await veNewo["convertToShares(uint256,uint256)"](100, years(3))
                ).to.be.equal(330);
        });
        it("convertToAssets 3 months return multiplier equal 1", async () => {
            expect(
                await veNewo["convertToAssets(uint256,uint256)"](100, days(90))
                ).to.be.equal(100);
        });
        it("convertToAssets without time returns min multipler", async () => {
            expect(
                await veNewo["convertToAssets(uint256)"](100)
                ).to.be.equal(100);
        });
        it("convertToAssets 3 years return multiplier equal 3.3", async () => {
            expect(
                await veNewo["convertToAssets(uint256,uint256)"](330, years(3))
                ).to.be.equal(100);
        });
        it("convertToAssets 2 years return multiplier equal 1.95", async () => {
            expect(
                await veNewo["convertToAssets(uint256,uint256)"](195, years(2))
                ).to.be.equal(100);
        });
        it("convertToAssets 9 months return multiplier equal 1.19", async () => {
            expect(
                await veNewo["convertToAssets(uint256,uint256)"](119, days(30 * 9))
                ).to.be.equal(100);
        });
    });

    /* impossible cases */
    describe("Deposit it for invalid days", () => {
        before(initialize);
        it("the depositor can't lock it for 0 days", async () => {
            await expect(
                veNewo
                    .connect(addr1)
                    ["deposit(uint256,address,uint256)"](
                        parseNewo(1000),
                        address(addr1),
                        days(0)
                    )
            ).to.be.revertedWith("Unauthorized()");
        });
        it("the depositor can't lock it for 30 days", async () => {
            await expect(
                veNewo
                    .connect(addr1)
                    ["deposit(uint256,address,uint256)"](
                        parseNewo(1000),
                        address(addr1),
                        days(30)
                    )
            ).to.be.revertedWith("Unauthorized()");
        });
        it("the depositor can't lock it for 4 years", async () => {
            await expect(
                veNewo
                    .connect(addr1)
                    ["deposit(uint256,address,uint256)"](
                        parseNewo(1000),
                        address(addr1),
                        years(4)
                    )
            ).to.be.revertedWith("Unauthorized()");
        });
    });
    
    describe("Deposit 0 for valid time", () => {
        before(initialize);
        it("the depositor can't lock 0", async () => {
            await expect(
                veNewo
                    .connect(addr1)
                    ["deposit(uint256,address,uint256)"](
                        parseNewo(0),
                        address(addr1),
                        years(1)
                    )
            ).to.be.revertedWith("Unauthorized()");
        });
    });

    describe("Deposit/withdraw using mint/redeem interface", () => {
        before(initialize);
        it("depositor must have the amount of shares asked", async () => {
            const lockTime = years(3);
            const expectedShares = parseNewo(673);

            await veNewo
                .connect(addr1)
                ["mint(uint256,address,uint256)"](
                    expectedShares, 
                    address(addr1),
                    lockTime 
                );

            const { balVeNewo: actualShares } = await checkBalances(addr1);
            const lowerBound = (expectedShares as BigNumber).mul(99999).div(100000);
            const upperBound = (expectedShares as BigNumber).mul(100001).div(100000);

            // +/- 0.001% margin
            expect(actualShares).to.be.gte(lowerBound).and.lte(upperBound);
        });
        it("third parties are not allowed to redeem in favor of another account", async () => {
            const lockTime = years(3);
            await timeTravel(lockTime + days(30));
            const amount = parseNewo(600);

            await expect(
                veNewo.connect(addr2)
                    .redeem(
                        amount, 
                        address(addr2),
                        address(addr1) 
                )).to.be.revertedWith("Unauthorized()");
        });
        it("redeem in favor of itself", async () => {
            const lockTime = years(3);
            const amount = parseNewo(600);
            const { balVeNewo: expectedShares } = await checkBalances(addr1);

            await veNewo.connect(addr1)
                    .redeem(
                        amount, 
                        address(addr1),
                        address(addr1) 
                );

            const { balVeNewo: actualShares } = await checkBalances(addr1);

            expect(actualShares).to.be.equal((expectedShares as BigNumber).sub(amount));
        });
        it("mint more to itself", async () => {
            const lockTime = years(3);
            const moreShares = parseNewo(600);
            const { balVeNewo: beforeShares } = await checkBalances(addr1);
            const expectedShares = (moreShares as BigNumber).add(beforeShares);

            await veNewo
                .connect(addr1)
                ["mint(uint256,address,uint256)"](
                    moreShares, 
                    address(addr1),
                    lockTime 
                );

            const lowerBound = (expectedShares as BigNumber).mul(99999).div(100000);
            const upperBound = (expectedShares as BigNumber).mul(100001).div(100000);
            const { balVeNewo: actualShares } = await checkBalances(addr1);

            // +/- 0.001% margin
            expect(actualShares).to.be.gte(lowerBound).and.lte(upperBound);
        });
        it("wait and exit all", async () => {
            await timeTravel(years(3));
            await veNewo.connect(addr1).exit();

            const { balVeNewo: actualShares, balStakeNewo: stakedShares } = await checkBalances(addr1);

            expect(actualShares).to.equal(0);
            expect(stakedShares).to.equal(0);
        });
    });

    // Try lock, withdraw and stake again
    // Try mint function, and redeem
    /* possible cases */
    testLock(days(90), days(30), 100);
    testLock(years(3), days(30), 100);
    testKickUser(days(90), days(30), 100);
    testKickUser(years(3), days(30), 100);
    testLockAndRelock(years(1), days(90), days(30), years(1), 50, 50);
    testLockAndRelock(years(2), days(90), days(6 * 30), days(30), 57, 13);
    testLockAndRelock(days(90), days(90), days(88), days(90), 29, 157);

    /**
     * Function to test lock and relocking mechanism
     * waitperiod1 is the time between deposits
     * waitperiod2 is the amount of time needed to withdraw all funds 
     * @param lockPeriod1 
     * @param lockPeriod2 
     * @param waitPeriod1 
     * @param waitPeriod2 
     * @param depositAmount1 
     * @param depositAmount2 
     */
    function testLockAndRelock(
        lockPeriod1: number,
        lockPeriod2: number,
        waitPeriod1: number,
        waitPeriod2: number,
        depositAmount1: number,
        depositAmount2: number,
    ) {
        const numDays = Math.round(lockPeriod1 / 86400);
        const numDaysW1 = Math.round(waitPeriod1 / 86400);
        const numDaysLock2 = Math.round(waitPeriod2 / 86400);

        describe(`Lock for ${numDays} days with restaking after ${numDaysW1} days for more ${numDaysLock2}.`, () => {
            before(initialize);

            let baseDate: number;
            let unlockDate: number;

            it("Total asset deposited is the sum of 2 deposits", async () => {
                await userDeposit(lockPeriod1, parseNewo(depositAmount1));
                
                // Get time when deposit happened
                const blockNumBefore = await ethers.provider.getBlockNumber();
                const blockBefore = await ethers.provider.getBlock(blockNumBefore);
                baseDate = blockBefore.timestamp;
                // time travel
                await timeTravel(waitPeriod1);
                // Second lock
                await userDeposit(lockPeriod2, parseNewo(depositAmount2));

                expect(
                    await veNewo.assetBalanceOf(await addr1.getAddress())
                    ).to.equal(parseNewo(depositAmount1 + depositAmount2));
            });
            it("Unlock date is the futherest date in the future", async () => {
                const unlockDateFirst = baseDate + lockPeriod1
                const unlockDateSecond = baseDate + waitPeriod1 + lockPeriod2 + 1; // Some rounding bullshit. Must add one to it
                unlockDate = unlockDateFirst >= unlockDateSecond ? unlockDateFirst : unlockDateSecond;

                expect(
                    await veNewo.unlockDate(await addr1.getAddress())
                    ).to.equal(unlockDate);
            });
            it("Try self withdraw but not in date", async () => {
                await expect(
                    veNewo.connect(addr1)
                    .withdraw(
                        parseNewo(depositAmount1),
                        await addr1.getAddress(),
                        await addr1.getAddress())
                    ).to.be.revertedWith("FundsNotUnlocked()");
            });
            it("Partial withdraw in date", async () => {
                const blockNumBefore = await ethers.provider.getBlockNumber();
                const blockBefore = await ethers.provider.getBlock(blockNumBefore);
                await timeTravel(unlockDate - blockBefore.timestamp);
                
                const {balVeNewo: sharesBefore, balStakeNewo: assetsBefore} = await checkBalances(addr1);
                const avgMult = BigNumber.from(sharesBefore).mul(100).div(BigNumber.from(assetsBefore));
                const expectedBurnShares = avgMult.mul(parseNewo(depositAmount1)).div(100);
                
                await veNewo.connect(addr1)
                    .withdraw(
                        parseNewo(depositAmount1),
                        await addr1.getAddress(),
                        await addr1.getAddress())
                
                const {balVeNewo: sharesAfter, balStakeNewo: assetsAfter} = await checkBalances(addr1);
                const shares = (sharesBefore as BigNumber).sub(sharesAfter as BigNumber);

                expect(shares).to.equal(expectedBurnShares);
            });
            it("Being kicked by someone else but not in date", async () => {
                await expect(
                    veNewo.connect(addr2)
                    .withdraw(
                        parseNewo(depositAmount2),
                        address(addr1),
                        address(addr1))
                    ).to.be.revertedWith("FundsNotUnlocked()");
            });
            it("Being kicked by someone else in date", async () => {
                await timeTravel(waitPeriod2);

                const {balNewo: kickerBefore} = await checkBalances(addr2);
                
                await veNewo.connect(addr2)
                        .withdraw(
                            parseNewo(depositAmount2),
                            address(addr1),
                            address(addr1));
                
                const {balNewo: kickerAfter} = await checkBalances(addr2);
                const {balVeNewo: kickedShares, balStakeNewo: kickedStaked} = await checkBalances(addr1);

                expect(kickedShares).to.be.equal(0);
                expect(kickedStaked).to.be.equal(0);
                expect(kickerAfter).to.be.gt(kickerBefore);
            });
        });
    }

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
                ).to.be.revertedWith("FundsNotUnlocked()");
            });
            it("the depositor should be able to exit the asset after unlock day", async () => {
                await timeTravel(restOfThePeriod);
                const { balNewo: balNewoBefore } = await checkBalances(addr1);

                // TODO: claim the rewards
                // await rewards.getReward();
                console.log("\texiting...");
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
                    "FundsNotUnlocked()"
                );
            });

            it("other user should be not able to kick out the user within the grace period", async () => {
                await timeTravel(restOfThePeriod + days(3));

                // exit
                console.log("\taddr2 try to withdraw for addr1");
                await expect(
                    veNewo
                        .connect(addr2)
                        .withdraw(
                            parseNewo(depositAmount),
                            address(addr1),
                            address(addr1)
                        )
                ).to.be.revertedWith("FundsNotUnlocked()");
            });

            it("other user should be able to kick out the user after the grace period", async () => {
                await timeTravel(days(4));
                const { balNewo: balNewoBefore } = await checkBalances(addr1);
                const { balNewo: balNewoAddr2Before } = await checkBalances(
                    addr2
                );

                // exit
                console.log("\taddr2 try to withdraw for addr1");
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

        describe("Testing RecoverERC20 functions", () => {
            before(initialize);
            it("changeWhitelistRecoverERC20 should be only callable by owner", async () => {
                await expect(veNewo
                    .connect(addr1)
                    .changeWhitelistRecoverERC20(address(USDC), true)
                ).to.be.revertedWith("Only the contract owner may perform this action")
            });
            it("Trying to recover a not white listed token should revert", async () => {
                await USDC
                    .connect(whale)
                    .transfer(address(veNewo), parseUSDC(10000));
                
                await expect(veNewo
                    .connect(owner)
                    .recoverERC20(address(USDC), parseUSDC(10000))
                ).to.be.revertedWith("NotWhitelisted()");
            });
            it("Only contract owner should be able to call recoverERC20", async () => {
                await expect(veNewo
                    .connect(addr1)
                    .recoverERC20(address(USDC), parseUSDC(10000))
                ).to.be.revertedWith("Only the contract owner may perform this action");
            });
            it("recoverERC20 should transfer the right amount of tokens to the owner", async () => {
                const { balUSDC: balUSDCOwnerBefore } = await checkBalances(owner);
                
                await veNewo
                    .connect(owner)
                    .changeWhitelistRecoverERC20(address(USDC), true)
                
                await veNewo.connect(owner)
                    .recoverERC20(address(USDC), parseUSDC(10000))
    
                const { balUSDC: balUSDCOwnerAfter } = await checkBalances(owner);
    
                expect((balUSDCOwnerAfter as BigNumber).sub(balUSDCOwnerBefore)).to.be.equal(parseUSDC(10000))
    
                expect(await USDC.balanceOf(address(veNewo))).to.be.equal(0);
            });
            it("Trying to transfer ERC20 more than the balance of the contract should revert", async () => {
                await USDC
                    .connect(whale)
                    .transfer(address(veNewo), parseUSDC(10000));
                
                expect(await USDC
                    .balanceOf(address(veNewo))
                ).to.be.equal(parseUSDC(10000));
                
                await expect(veNewo.connect(owner)
                    .recoverERC20(address(USDC), parseUSDC(10001))
                ).to.be.reverted
            })
    
        })
    }

    async function userDeposit(totalLockPeriod: number, amount: BigNumberish) {
        const { balNewo: balNewoBefore } = await checkBalances(addr1);

        // deposit
        console.log("\tdepositing...");
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
        const balStakeNewo = await stakeBalanceNewo(signer);
        const balUSDC = await balanceUSDC(signer);
        // console.log(
        //     `\tbalance of newo of ${address(signer)}: ${formatNewo(balNewo)}`
        // );
        // console.log(
        //     `\tbalance of veNewo of ${address(signer)}: ${formatVeNewo(
        //         balVeNewo
        //     )}`
        // );
        // console.log(
        //     `\tbalance of staked newo of ${address(signer)}: ${formatNewo(balNewo)}`
        // );
        return { balNewo, balVeNewo, balStakeNewo, balUSDC };
    }
});
