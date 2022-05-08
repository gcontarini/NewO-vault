import { expect } from "chai";
import { ethers } from "hardhat";
import hre = require("hardhat");
import { 
    VeNewO,
    XNewO,
    Rewards,
    IUniswapV2Pair,
    IUniswapV2Router02,
    VeNewO__factory,
    XNewO__factory, 
    Rewards__factory, 
} from '../typechain'
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
} from "./utils";

const lPAddress = "0xc08ED9a9ABEAbcC53875787573DC32Eee5E43513";
const newoTokenAddress = "0x98585dFc8d9e7D48F0b1aE47ce33332CF4237D96";
const USDCAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const TreasuryAddress = "0xdb36b23964FAB32dCa717c99D6AEFC9FB5748f3a";
const ROUTERADDRESS = "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F";
const WhaleAddress = "0x1B7BAa734C00298b9429b518D621753Bb0f6efF2";

describe("xNewo tests", function () {
    
    let VeNewo: VeNewO__factory;
    let XNewo: XNewO__factory;
    let Rewards: Rewards__factory;
    let lp: IUniswapV2Pair;
    let ROUTER: IUniswapV2Router02;
    let newoToken: Contract;
    let USDC: Contract;

    let rewards: Rewards;
    let xNewo: XNewO;
    let veNewo: VeNewO;

    let owner: Signer;
    let addr1: Signer;
    let addr2: Signer;
    let treasury: Signer;
    let whale: Signer;

    let ownerAddress: string;
    let treasuryAddress: string;
    let addr1Address: string;

    let balanceNewo: (entity: any) => Promise<BigNumberish>;
    let balanceVeNewo: (entity: any) => Promise<BigNumberish>;
    let balanceLp: (entity: any) => Promise<BigNumberish>;
    let balanceXNewo: (entity: any) => Promise<BigNumberish>;
    let balanceUSDC: (entity: any) => Promise<BigNumberish>;

    let parseNewo: (input: number) => BigNumberish;
    let parseVeNewo: (input: number) => BigNumberish;
    let parseLp: (input: number) => BigNumberish;
    let parseXNewo: (input: number) => BigNumberish;
    let parseUSDC: (input: number) => BigNumberish;

    let formatNewo: (input: BigNumberish) => string;
    let formatVeNewo: (input: BigNumberish) => string;
    let formatLp: (input: BigNumberish) => string;
    let formatXNewo: (input: BigNumberish) => string;
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

        lp = await ethers.getContractAt("IUniswapV2Pair", lPAddress);
        balanceLp = balance(lp);
        parseLp = await parseToken(lp);
        formatLp = await formatToken(lp);

        USDC = await ethers.getContractAt(USDCABI, USDCAddress)
        balanceUSDC = balance(USDC);
        parseUSDC = await parseToken(USDC);
        formatUSDC = await formatToken(USDC);

        ROUTER = await ethers.getContractAt("IUniswapV2Router02", ROUTERADDRESS);

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
            "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        ]);

        treasury = await ethers.getSigner(TreasuryAddress);

        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [WhaleAddress],
        });

        // Grant more gas to account
        await hre.network.provider.send("hardhat_setBalance", [
            WhaleAddress,
            "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        ]);

        whale = await ethers.getSigner(WhaleAddress)

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

        xNewo = await XNewo.deploy(
            ownerAddress,
            lPAddress,
            newoTokenAddress, 
            veNewo.address, 
            TreasuryAddress
        );
        await xNewo.deployed()
        balanceXNewo = balance(xNewo);
        parseXNewo = await parseToken(xNewo);
        formatXNewo = await formatToken(xNewo);

        // Transfer some Newo to addr1 so he can spend freelly;
        const numberOfTokens = parseNewo(10000);
        await newoToken
            .connect(treasury)
            .transfer(addr1Address, numberOfTokens
        );
        
        // Transfer some USDC to addr1 so he can add liquidity
        const numberOfUSDCTokens = parseUSDC(1000);
        await USDC
            .connect(whale)
            .transfer(addr1Address, numberOfUSDCTokens
        );
        
        // Transfer some USDC to addr2 so he can add liquidity
        await USDC
            .connect(whale)
            .transfer(address(addr2), numberOfUSDCTokens
        );

        // approve the token to addr1
        await newoToken
            .connect(addr1)
            .approve(
                address(veNewo),
                "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
        );
        
        // aprove lp spending to addr1
        await lp
            .connect(addr1)
            .approve(
                address(xNewo),
                "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
        );

        // aprove USDC spending to addr1
        await USDC
            .connect(addr1)
            .approve(
                address(ROUTER),
                "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
        );

        // aprove NewO spending to addr1
        await newoToken
            .connect(addr1)
            .approve(
                address(ROUTER),
                "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
        );

        // aprove USDC spending to addr2
        await USDC
            .connect(addr2)
            .approve(
                address(ROUTER),
                "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
        );

        // aprove NewO spending to addr2
        await newoToken
            .connect(addr2)
            .approve(
                address(ROUTER),
                "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
        );

        // aprove lp spending to addr2
        await lp
            .connect(addr2)
            .approve(
                address(xNewo),
                "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
        );
    };

    // Tests for view functions
    describe("Test view functions for simplest case.", async () => {        
        before(initialize);
        it("asset equal to token address", async () => {
            const tokenAddr = await xNewo.asset();

            expect(tokenAddr).to.equal(address(lp));
        });
        it("totalAssets equal to zero", async () => {
            const total = await xNewo.totalAssets();

            expect(total).to.equal(0);
        });
        it("totalSupply equal to zero", async () => {
            const total = await xNewo.totalSupply();

            expect(total).to.equal(0);
        });
        it("balanceOf equal to zero", async () => {
            const total = await xNewo.balanceOf(await addr1.getAddress());

            expect(total).to.equal(0);
        });
        it("convertToShares equal to zero", async () => {
            const total = await xNewo.convertToShares(0);

            expect(total).to.equal(0);
        });
        it("convertToAssets equal to zero", async () => {
            const total = await xNewo.convertToAssets(0);
            
            expect(total).to.equal(0);
        });
        it("maxDeposit returns max uint256", async () => {
            const total = await xNewo.maxDeposit(address(addr1));
            
            expect(total).to.equal(ethers.constants.MaxUint256);
        });
        it("previewDeposit with zero assets", async () => {
            const total = await xNewo.previewDeposit(0);
            expect(total).to.equal(0);
        });
        it("maxMint returns max uint256", async () => {
            const total = await xNewo.maxMint(address(addr1));
            
            expect(total).to.equal(ethers.constants.MaxUint256);
        });
        it("previewMint with zero shares", async () => {
            const total = await xNewo.previewMint(0);
            
            expect(total).to.equal(0);
        });
        it("maxWithdraw with zero balance", async () => {
            const total = await xNewo.maxWithdraw(address(addr1));
            
            expect(total).to.equal(0);
        });
        it("maxRedeem with zero balance", async () => {
            const total = await xNewo.maxRedeem(address(addr1));
            
            expect(total).to.equal(0);
        });
        it("previewRedeem with zero shares", async () => {
            const total = await xNewo.previewRedeem(0);
            
            expect(total).to.equal(0);
        });
        it("assetBalanceOf with zero assets", async () => {
            const total = await xNewo.assetBalanceOf(address(addr1));
            
            expect(total).to.equal(0);
        });
    })

    /* Testing ERC20 transfer lock */
    describe("Testing if xNewO is not transferable", () => {
        before(initialize)
        it("Approve function should revert", async () => {
            const numberOfXTokens = parseLp(2);
            await lp
                .connect(treasury)
                .transfer(addr1Address, numberOfXTokens
            );
            await expect (
                xNewo
                    .connect(addr1)
                    .approve(
                        address(addr1),
                        parseXNewo(1),
                    )
            ).to.be.reverted;
        })
        it("Transfer function should revert", async () => {
            await expect (
                xNewo
                    .connect(addr1)
                    .transfer(
                        address(addr1),
                        parseXNewo(1),
                    )
            ).to.be.reverted;
        })
        it("transferFrom function should revert", async () => {
            await expect (
                xNewo
                    .connect(addr1)
                    .transferFrom(
                        address(addr2),
                        address(addr1),
                        parseXNewo(1),
                    )
            ).to.be.reverted;
        })
        it("allowance function should return 0", async () => {
            expect(
                await xNewo
                    .connect(addr1)
                    .allowance(
                        address(addr1),
                        address(addr2),
                    )
            ).to.equal(0);
        })
    });

    /* Tests for External View functions */
    describe("Testing getNewoShare()" , () => {
        before(initialize);
        it("getNewoShare() should return 0 if address is not a liquidity provider", async () => {
            
            expect(await lp
                .balanceOf(address(addr1))
            ).to.be.equal(0);

            expect(await xNewo
                .getNewoShare(address(addr1))
            ).to.be.equal(0);
        });

        it("getNewoShare() should return amount of newo added to the liquidity pool", async () => {
            
            const { 
                newoAdded: newoPool,
                lpAdded: lpEarned
            } = await addSushiLiquidity(addr1, 10000, 700);
            
            await xNewo
                .connect(addr1)
                .deposit(lpEarned, address(addr1));
            
            const newoLpShares = await xNewo.getNewoShare(address(addr1));

            // +/- 0.001% margin
            const lowerBound = (newoPool as BigNumber).mul(99999).div(100000);
            const upperBound = (newoPool as BigNumber).mul(100001).div(100000);

            expect(newoLpShares).to.be.gte(lowerBound).and.lte(upperBound);
        });
    });

    describe("Testing getMultiplier()", () => {
        before(initialize);
        it("Multiplier should be 1 if veVault is empty", async () => {
            expect(await veNewo
                .totalAssets()
            ).to.be.equal(0)
            
            expect (await xNewo
                .getMultiplier(address(addr1))
            ).to.be.equal(1);
        })

        it("Multiplier should be 1 if address has no veNewo", async () => {
            expect(await veNewo
                .balanceOf(address(addr1))
            ).to.be.equal(0);
            
            expect(await xNewo
                .getMultiplier(address(addr1))
            ).to.be.equal(1)
        })
        
        it("Multiplier should be equal to VeMultipler when address has veNewo", async () => {
            const { 
                balNewo: balNewoBefore 
            } = await checkBalances(addr1);
            
            await veNewo
                .connect(addr1)
                ["deposit(uint256,address)"](
                    balNewoBefore, address(addr1)
                );
            
            expect(await veNewo
                .balanceOf(address(addr1))
            ).to.not.equal(0);
        })
    });

    describe("Testing getNewoLocked()", () => {
        before(initialize);
        it("getNewoLocked() should return zero if owner has no veNewO", async () => {
            
            expect(await veNewo
                .balanceOf(address(addr1)))
            .to.be.equal(0);
            
            expect (await xNewo
                .getNewoLocked(address(addr1)))
            .to.be.equal(0);
        })
        it("getNewoLocked() should return the amount of NewO locked", async () => {
            const { 
                balNewo: balNewoBefore 
            } = await checkBalances(addr1);

            await veNewo
                .connect(addr1)
                ["deposit(uint256,address)"](
                    balNewoBefore, address(addr1)
                );
            
            expect(await xNewo
                .getNewoLocked(address(addr1)))
            .to.be.equal(balNewoBefore);
        })
    })

    describe("Testing deposit()", () => {
        before(initialize);
        it("deposit should add the right amount of assets to the Vault", async () => {
            expect(await xNewo
                .totalAssets()
            ).to.be.equal(0)
            
            await addSushiLiquidity(addr1, 10000, 700);
            
            const { 
                balLp: lpBalBefore
            } = await checkBalances(addr1);
            
            await xNewo
                .connect(addr1)
                .deposit(lpBalBefore, address(addr1))

            expect(await xNewo
                .totalAssets()
            ).to.be.equal(lpBalBefore);
        })
    })

    describe("", () => {
        before(initialize);
        it("If depositor has no veNewo, vault should mint xNewo on the same amount of lp staked", async () => {
            
            await addSushiLiquidity(addr1, 10000, 700);
            
            expect(await veNewo
                .balanceOf(address(addr1))
            ).to.be.equal(0);

            const { 
                balLp: balLpBefore
            } = await checkBalances(addr1);

            await xNewo
                .connect(addr1)
                .deposit(balLpBefore, address(addr1)
                );
            
            expect(await xNewo
                .balanceOf(address(addr1))
            ).to.be.equal(balLpBefore)
        })
    })

    describe("", () => {
        before(initialize);
        it("If address locked for min locktime and address has more newO locked than staked, hes bonus is 0", async () => {
            const newoToLock = 1000;
            await addSushiLiquidity(addr1, 100, 7);

            const { balLp: balLpBefore } = await checkBalances(addr1);

            await veNewo
                .connect(addr1)
                ["deposit(uint256,address)"](parseNewo(newoToLock), address(addr1));
            
            await xNewo
                .connect(addr1)
                .deposit(balLpBefore, address(addr1)
            );

            const {
                balXNewo: balXAfter,
            } = await checkBalances(addr1);

            expect(balXAfter as BigNumber).to.be.equal(balLpBefore);
        })
    })

    describe("", () => {
        before(initialize);
        it("If address locked newo for more than min locktime and address has more newO locked than staked, his bonus is positive", async () => {
            const newoToLock = 1000;
            await addSushiLiquidity(addr1, 100, 7);

            const { balLp: balLpBefore } = await checkBalances(addr1);

            await veNewo
                .connect(addr1)
                ["deposit(uint256,address,uint256)"]
                (parseNewo(newoToLock), address(addr1), years(2));
            
            await xNewo
                .connect(addr1)
                .deposit(balLpBefore, address(addr1)
            );

            const {
                balXNewo: balXAfter,
            } = await checkBalances(addr1);

            expect(balXAfter as BigNumber).to.gt(balLpBefore);
        })
    })

    describe("", () => {
        before(initialize);
        it("If address locked newo for more than min locktime and address has more newO locked than staked, his bonus should be equal to veMult", async () => {
            const newoToLock = 1000;
            await addSushiLiquidity(addr1, 999, 70);

            const { balLp: balLpBefore } = await checkBalances(addr1);

            await veNewo
                .connect(addr1)
                ["deposit(uint256,address,uint256)"]
                (parseNewo(newoToLock), address(addr1), years(2));
            
            await xNewo
                .connect(addr1)
                .deposit(balLpBefore, address(addr1)
            );

            const {
                balVeNewo: balVeAfter,
                balXNewo: balXAfter,
            } = await checkBalances(addr1);

            const veMult = (balXAfter as BigNumber).mul("10000000000000000").div(balLpBefore)
            const xMult = (balVeAfter as BigNumber).mul("10000000000000000").div(parseNewo(newoToLock))

            // +/- 0.001% margin
            const lowerBound = (xMult as BigNumber).mul(99999).div(100000);
            const upperBound = (xMult as BigNumber).mul(100001).div(100000);
        
            expect(veMult).to.be.gte(lowerBound).and.lte(upperBound);

        })
    })

    describe("", () => {
        before(initialize);
        it("If address locked newo for more than min locktime but address has less newO locked than staked hes bonus should be 0", async () => {
            const newoToLock = 100;
            await addSushiLiquidity(addr1, 1000, 70);

            const { balLp: balLpBefore } = await checkBalances(addr1);

            await veNewo
                .connect(addr1)
                ["deposit(uint256,address,uint256)"]
                (parseNewo(newoToLock), address(addr1), years(2));
            
            await xNewo
                .connect(addr1)
                .deposit(balLpBefore, address(addr1)
            );

            const {
                balXNewo: balXAfter,
            } = await checkBalances(addr1);

            expect(balXAfter as BigNumber).to.be.equal(balLpBefore);

        })
    })

    describe("", () => {
        before(initialize);
        it("If address locked newo for more than min locktime and address has same amount of newO locked and staked, hes bonus should be positive", async () => {
            const {lpAdded: lpEarned , newoAdded: newoStaked} = await addSushiLiquidity(addr1, 100, 7);

            const { balLp: balLpBefore } = await checkBalances(addr1);

            await veNewo
                .connect(addr1)
                ["deposit(uint256,address,uint256)"]
                (newoStaked, address(addr1), years(2));
            
            await xNewo
                .connect(addr1)
                .deposit(lpEarned, address(addr1)
            );

            const {
                balXNewo: balXAfter,
            } = await checkBalances(addr1);

            expect(balXAfter as BigNumber).to.gt(balLpBefore);
        })
    })

    describe("Testing Rewards", () => {
        before(initialize);
        it("notifyRewardAmount should only be callable by Rewards Distributor", async () => {
            const numberOfTokens = parseNewo(1000)
            await expect(xNewo
                .connect(addr1)
                .notifyRewardAmount(numberOfTokens)
            ).to.be.reverted;
        })
        it("Rewards token is NewO token", async () => {
            expect(await xNewo
                .rewardsToken()
            ).to.be.equal(newoTokenAddress);
        });
        it("If vault has no rewards to distribute, calling notifyRewardAmount should revert", async () => {
            const numberOfTokens = parseNewo(1000)
            await expect(xNewo
                .connect(treasury)
                .notifyRewardAmount(numberOfTokens)
            ).to.be.revertedWith("RewardTooHigh");
        });
        it("setRewardsDuration() should revert if not called by owner", async () => {
            await expect(xNewo
                .connect(addr1)
                .setRewardsDuration(days(20))
            ).to.be.revertedWith("Only the contract owner may perform this action");
        });
        it("setRewardsDuration() should set the right rewards duration", async () => {
            await xNewo
                .connect(owner)
                .setRewardsDuration(days(20))
            
            expect(await xNewo
                .rewardsDuration()
            ).to.be.equal(days(20));
        });
        it("notifyRewardAmount() should set the right reward rate", async () => {
            const {
                lpAdded: lpEarned
            } = await addSushiLiquidity(addr1, 10000, 700);

            const tokensToReward = parseNewo(10000);
            await newoToken
                .connect(treasury)
                .transfer(address(xNewo),tokensToReward);

            await xNewo
                .connect(treasury)
                .notifyRewardAmount(tokensToReward);
            
            await xNewo
                .connect(addr1)
                .deposit(lpEarned, address(addr1));

            const rewardRate = (tokensToReward as BigNumber).div(days(20))
            const rewardR = await xNewo.rewardRate();

            expect(rewardR).to.be.equal(rewardRate); 
        });
        it("getRewardForDuration() should return the right reward for the duration", async () => {
            const tokensToReward = parseNewo(10000);
            const rewardRate = (tokensToReward as BigNumber).div(days(20));
            const rewardDuration = await xNewo.getRewardForDuration();
            
            expect(rewardDuration)
                .to.be.equal((rewardRate as BigNumber)
                .mul(days(20))
            );
        });
        it("getReward() should transfer reward", async () => {
            const { balNewo: balNewoBefore } = await checkBalances(addr1)
            await timeTravel(days(30));
            
            await xNewo.connect(addr1).getReward();
            const { balNewo: balNewoAfter } = await checkBalances(addr1)

            expect(balNewoAfter).to.gt(balNewoBefore);
        })
    })

    describe("Testing RecoverERC20 functions", () => {
        before(initialize);
        it("changeWhitelistRecoverERC20 should be only callable by owner", async () => {
            await expect(xNewo
                .connect(addr1)
                .changeWhitelistRecoverERC20(address(USDC), true)
            ).to.be.revertedWith("Only the contract owner may perform this action")
        });
        it("Trying to recover a not white listed token should revert", async () => {
            await USDC
                .connect(whale)
                .transfer(address(xNewo), parseUSDC(10000));
            
            await expect(xNewo
                .connect(owner)
                .recoverERC20(address(USDC), parseUSDC(10000))
            ).to.be.revertedWith("NotWhitelisted()");
        });
        it("Only contract owner should be able to call recoverERC20", async () => {
            await expect(xNewo
                .connect(addr1)
                .recoverERC20(address(USDC), parseUSDC(10000))
            ).to.be.revertedWith("Only the contract owner may perform this action");
        });
        it("recoverERC20 should transfer the right amount of tokens to the owner", async () => {
            const { balUSDC: balUSDCOwnerBefore } = await checkBalances(owner);
            
            await xNewo
                .connect(owner)
                .changeWhitelistRecoverERC20(address(USDC), true)
            
            await xNewo.connect(owner)
                .recoverERC20(address(USDC), parseUSDC(10000))

            const { balUSDC: balUSDCOwnerAfter } = await checkBalances(owner);

            expect((balUSDCOwnerAfter as BigNumber).sub(balUSDCOwnerBefore)).to.be.equal(parseUSDC(10000))

            expect(await USDC.balanceOf(address(xNewo))).to.be.equal(0);
        });
        it("Trying to transfer ERC20 more than the balance of the contract should revert with error", async () => {
            await USDC
                .connect(whale)
                .transfer(address(xNewo), parseUSDC(10000));
            
            expect(await USDC
                .balanceOf(address(xNewo))
            ).to.be.equal(parseUSDC(10000));
            
            await expect(xNewo.connect(owner)
                .recoverERC20(address(USDC), parseUSDC(10001))
            ).to.be.revertedWith("InsufficientBalance()")
        })

    })

    describe("Hardcore test", () => {
        before(initialize);
        it("Accounts should earn rewards based on shares (addr1 has bonus)", async () => {
            await setReward(10000, years(2));
            const lpToStake = parseLp(0.0001);
            const newoToLock = parseNewo(10000)
            
            await lp.connect(treasury)
                .transfer(address(addr2), lpToStake)

            await lp.connect(treasury)
                .transfer(address(addr1), lpToStake)

            await veNewo
                .connect(addr1)
                ["deposit(uint256,address,uint256)"]
                (newoToLock, address(addr1), years(2));
            
            await xNewo
                .connect(addr2)
                .deposit(lpToStake, address(addr2))
            
            await xNewo
                .connect(addr1)
                .deposit(lpToStake, address(addr1))
            
            await timeTravel(years(2));

            await xNewo.connect(addr2).getReward();
            await xNewo.connect(addr1).getReward();

            console.log("\n Account 1 after rewards");
            
            const { balNewo: balNewoAddr1After } = await checkBalances(addr1);

            console.log("\n Account 2 after rewards");

            const {balNewo: balNewoAddr2After} = await checkBalances(addr2);

            expect(balNewoAddr1After).to.gt(balNewoAddr2After)
        })
    })

    describe("Hardcore test", () => {
        before(initialize);
        it("Accounts should earn rewards based on shares(one accout has veNewoMultiplier and the other dont)", async () => {
            await setReward(10000, years(2));

            const newoToLp = 1000;
            const USDCToLp = 350;

            // give addr2 some newo
            await newoToken
                .connect(treasury)
                .transfer(address(addr2), parseNewo(1000));

            const {
                lpAdded: lpAddr2,
            } = await addSushiLiquidity(addr2, newoToLp, USDCToLp);
                        
            const {
                lpAdded: lpAddr1,
            } = await addSushiLiquidity(addr1, newoToLp, USDCToLp);

            expect(lpAddr1).to.be.equal(lpAddr2);
            
            // addr1 lock newo for veNewo to earn bonus
            await veNewo
                .connect(addr1)
                ["deposit(uint256,address,uint256)"]
                (parseNewo(1000), address(addr1), years(3));            
            
            await xNewo
                .connect(addr2)
                .deposit(lpAddr2, address(addr2))
            
            await xNewo
                .connect(addr1)
                .deposit(lpAddr1, address(addr1))
            
            await timeTravel(years(2));

            const {balNewo: balAddr1BeforeReward} = await checkBalances(addr1);
            const {balNewo: balAddr2BeforeReward} = await checkBalances(addr2);

            await xNewo.connect(addr2).getReward();
            await xNewo.connect(addr1).getReward();

            console.log("\n Account 1 after rewards");
            
            const {balNewo: balNewoAddr1After} = await checkBalances(addr1);

            console.log("\n Account 2 after rewards");

            const {balNewo: balNewoAddr2After} = await checkBalances(addr2);

            const newoEarnedAddr1 = (balNewoAddr1After as BigNumber).sub(balAddr1BeforeReward)
            const newoEarnedAddr2 = (balNewoAddr2After as BigNumber).sub(balAddr2BeforeReward)

            // Check if rewards were fully distributed:

            const distributed = (newoEarnedAddr1 as BigNumber).add(newoEarnedAddr2)

            // +/- 0.001% margin
            const lowerBound = (distributed as BigNumber).mul(99999).div(100000);
            const upperBound = (distributed as BigNumber).mul(100001).div(100000);

            expect(parseNewo(10000)).to.be.gte(lowerBound).and.lte(upperBound);
            
            expect(newoEarnedAddr1).to.gt(newoEarnedAddr2)
        });
    })

    describe("Hardcore test", () => {
        before(initialize);
        it("If both address withdraw everything the balance of assets and shares should be zero", async () => {
            await setReward(10000, years(2));
            
            const newoToLp = 1000;
            const USDCToLp = 350;

            // give addr2 some newo
            await newoToken
                .connect(treasury)
                .transfer(address(addr2), parseNewo(1000));

            const {
                lpAdded: lpAddr2,
            } = await addSushiLiquidity(addr2, newoToLp, USDCToLp);
                        
            const {
                lpAdded: lpAddr1,
            } = await addSushiLiquidity(addr1, newoToLp, USDCToLp);

            expect(lpAddr1).to.be.equal(lpAddr2);
            
            // addr1 lock newo for veNewo to earn bonus
            await veNewo
                .connect(addr1)
                ["deposit(uint256,address,uint256)"]
                (parseNewo(1000), address(addr1), years(3));            
            
            await xNewo
                .connect(addr2)
                .deposit(lpAddr2, address(addr2))
            
            await xNewo
                .connect(addr1)
                .deposit(lpAddr1, address(addr1))
            
            await timeTravel(years(2));

            await xNewo.connect(addr2).getReward();
            await xNewo.connect(addr1).getReward();

            const lpStakedNewoAddr1 = await xNewo.assetBalanceOf(address(addr1));
            const lpStakedNewoAddr2 = await xNewo.assetBalanceOf(address(addr2));

            await xNewo
                .connect(addr1)
                .withdraw(lpStakedNewoAddr1, address(addr1), address(addr1));
            

            await xNewo
                .connect(addr2)
                .withdraw(lpStakedNewoAddr2, address(addr2), address(addr2));

            const { balXNewo: balXAddr1After } = await checkBalances(addr1)
            const { balXNewo: balXAddr2After } = await checkBalances(addr2)

            expect(balXAddr1After).to.be.equal(0)
            expect(balXAddr2After).to.be.equal(0)

            expect(await xNewo
                .totalAssets()
            ).to.be.equal(0)

            expect(await xNewo
                .balanceOf(address(addr1))
            ).to.be.equal(0)

            expect(await xNewo
                .totalSupply()
            ).to.be.equal(0)

            expect(await xNewo
                .balanceOf(address(addr2))
            ).to.be.equal(0)
        });
    })

    describe("Hardcore test", () => {
        before(initialize);
        it("exit function should distribute rewards and withdraw everything to the caller", async () => {
            await setReward(10000, years(2));

            const newoToLp = 1000;
            const USDCToLp = 350;

            // give addr2 some newo
            await newoToken
                .connect(treasury)
                .transfer(address(addr2), parseNewo(newoToLp));

            const {
                lpAdded: lpAddr2,
                newoAdded: newoToLpAddr2
            } = await addSushiLiquidity(addr2, newoToLp, USDCToLp);
                        
            const {
                lpAdded: lpAddr1,
                newoAdded: newoToLpAddr1
            } = await addSushiLiquidity(addr1, newoToLp, USDCToLp);
            
            console.log("Account 2 Newo added to Lp", newoToLpAddr2);
            console.log("Account 1 Newo added to Lp", newoToLpAddr1);
            
            // addr1 lock newo for veNewo to earn bonus
            await veNewo
                .connect(addr1)
                ["deposit(uint256,address,uint256)"]
                (parseNewo(1000), address(addr1), years(3));            
            
            await xNewo
                .connect(addr2)
                .deposit(lpAddr2, address(addr2))
            
            await xNewo
                .connect(addr1)
                .deposit(lpAddr1, address(addr1))
            
            await timeTravel(years(3));

            const { balNewo: balNewoAddr1BeforeExit } = await checkBalances(addr1);
            const { balNewo: balNewoAddr2BeforeExit } = await checkBalances(addr2);

            await xNewo.connect(addr1).exit();
            await xNewo.connect(addr2).exit();
            
            const {balXNewo: balXAddr1After, balNewo: balNewoAddr1AfterExit} = await checkBalances(addr1)
            const {balXNewo: balXAddr2After, balNewo: balNewoAddr2AfterExit} = await checkBalances(addr2)

            const newoRewardAddr1 = (balNewoAddr1AfterExit as BigNumber).sub(balNewoAddr1BeforeExit)
            const newoRewardAddr2 = (balNewoAddr2AfterExit as BigNumber).sub(balNewoAddr2BeforeExit)

            // Check if rewards were fully distributed:
            const distributed = (newoRewardAddr1 as BigNumber).add(newoRewardAddr2)

            // +/- 0.001% margin
            const lowerBound = (distributed as BigNumber).mul(99999).div(100000);
            const upperBound = (distributed as BigNumber).mul(100001).div(100000);

            expect(parseNewo(10000)).to.be.gte(lowerBound).and.lte(upperBound);

            expect(newoRewardAddr1).to.gt(newoRewardAddr2);
            expect(balXAddr1After).to.be.equal(0)
            expect(balXAddr2After).to.be.equal(0)

            expect(await xNewo
                .totalAssets()
            ).to.be.equal(0)

            expect(await xNewo
                .balanceOf(address(addr1))
            ).to.be.equal(0)

            expect(await xNewo
                .totalSupply()
            ).to.be.equal(0)

            expect(await xNewo
                .balanceOf(address(addr2))
            ).to.be.equal(0)
        });
    })

    describe("Hardcore test", () => {
        before(initialize);

    })

    async function addSushiLiquidity(signer: Signer, NewoAmount: number, USDCAmount: number){
        const { 
            balNewo: newOBalBefore,
            balUSDC: USDCBalBefore,
            balLp: lpBalBefore 
        } = await checkBalances(signer);

        console.log(`\tadding liquidity by ${address(signer)}...\n\n`);
        
        await ROUTER.connect(signer).addLiquidity(
            address(newoToken),
            address(USDC),
            parseNewo(NewoAmount),
            parseUSDC(USDCAmount),
            parseNewo(1),
            parseUSDC(1),
            address(signer),
            999999999999,
        );
        
        const { 
            balNewo: newOBalAfter,
            balUSDC: USDCBalAfter,
            balLp: lpBalAfter
        } = await checkBalances(signer);
        
        const newoAdded = (newOBalBefore as BigNumber).sub(newOBalAfter);
        const USDCAdded = (USDCBalBefore as BigNumber).sub(USDCBalAfter);
        const lpAdded = (lpBalAfter as BigNumber).sub(lpBalBefore);
        
        return { newoAdded, USDCAdded, lpAdded }
    }

    async function setReward(rewardAmount: number, distributionPeriod: number) {

        const tokensToReward = parseNewo(rewardAmount);
        
        console.log("\n Setting distribution reward");
        
        await xNewo
            .connect(owner)
            .setRewardsDuration(distributionPeriod)

        await newoToken
            .connect(treasury)
            .transfer(address(xNewo),tokensToReward);

        await xNewo
            .connect(treasury)
            .notifyRewardAmount(tokensToReward);

    }

    async function checkBalances(signer: Signer) {
        const balNewo = await balanceNewo(signer);
        const balVeNewo = await balanceVeNewo(signer);
        const balXNewo = await balanceXNewo(signer);
        const balLp = await balanceLp(signer);
        const balUSDC = await balanceUSDC(signer);
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
        console.log(
            `\tbalance of XNewo of ${address(signer)}: ${formatXNewo(
                balXNewo
            )}`
        );
        console.log(
            `\tbalance of Lp of ${address(signer)}: ${formatLp(
                balLp
            )}`
        );
        console.log(
            `\tbalance of USDC of ${address(signer)}: ${formatUSDC(
                balUSDC
            )}\n`
        );
        return { balNewo, balVeNewo , balXNewo, balLp, balUSDC };
    }
});