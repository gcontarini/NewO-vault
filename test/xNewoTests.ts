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

        // Grant more gas to this sucker
        await hre.network.provider.send("hardhat_setBalance", [
            TreasuryAddress,
            "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        ]);

        treasury = await ethers.getSigner(TreasuryAddress);

        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [WhaleAddress],
        });

        // Grant more gas to this other sucker
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
            ownerAddress
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
        const numberOfUSDCTokens = parseUSDC(11000);
        await USDC
            .connect(whale)
            .transfer(addr1Address, numberOfUSDCTokens
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
            expect(newoLpShares).to.be.equal(newoPool.toString());
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

            expect(await veNewo
                    .avgVeMult(address(addr1))
            ).to.be.equal(await xNewo
                    .getMultiplier(address(addr1))
                );
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