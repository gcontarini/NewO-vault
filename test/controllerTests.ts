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

describe("Controller tests", async function () {
    let VeNewo: VeNewO__factory;
    let XNewo: XNewO__factory;
    let Rewards: Rewards__factory;
    let newoToken: Contract;
    let RewardsController: RewardsController__factory;

    let veNewo: VeNewO;
    let rewards: Rewards;
    let rewards1: Rewards;
    let rewards2: Rewards;
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

        // rewards contracts deployement
        rewards = await Rewards.deploy(
            ownerAddress,
            veNewo.address,
            TreasuryAddress,
            newoTokenAddress
        );
        await rewards.deployed();

        rewards1 = await Rewards.deploy(
            ownerAddress,
            veNewo.address,
            TreasuryAddress,
            newoTokenAddress
        );
        await rewards1.deployed();

        rewards2 = await Rewards.deploy(
            ownerAddress,
            veNewo.address,
            TreasuryAddress,
            newoTokenAddress
        );
        await rewards2.deployed();

        controller = await RewardsController.deploy(ownerAddress, veNewo.address);
        await controller.deployed();

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

    describe("Testing updateLegalDeclaration()", () => {
        before(initialize);

        it("Should only be callable by the owner", async () => {
            await expect(controller.connect(addr1).updateLegalDeclaration(declaration)).to.be.revertedWith("Only the contract owner may perform this action");

            await expect(controller.connect(owner).updateLegalDeclaration(declaration)).to.not.be.reverted;
        })

        it("Should update the declaration", async () => {
            let newDeclaration = "I don't agree with nothing";
            await controller.connect(owner).updateLegalDeclaration(newDeclaration);

            expect(await controller.legalDeclaration()).to.be.equal(newDeclaration);
        })
    });

    describe("Testing addRewardsContract()", () => {
        before(initialize);

        it("Should only be callable by the owner", async () => {
            await expect(controller.connect(addr1).addRewardsContract(rewards.address)).to.be.revertedWith("Only the contract owner may perform this action");

            await expect(controller.connect(owner).addRewardsContract(rewards.address)).to.not.be.reverted;
        })

        it("Should add a new rewards contract", async () => {
            expect(await controller.rewardsContracts(0)).to.be.equal(rewards.address);

            let rewardsAuth = await controller.rewardsContractsAuth(rewards.address);

            expect(rewardsAuth.isAuth).to.be.true;
        })

        it("Should not allow to add duplicated rewards contracts", async () => {
            await expect(controller.connect(owner).addRewardsContract(rewards.address)).to.be.revertedWith("RewardsContractAlreadyExists()");
        })
    })

    describe("Testing removeRewardsContract()", () => {
        before(initialize);

        it("Should only be callable by the owner", async () => {
            await expect(controller.connect(addr1).removeRewardsContract(rewards.address)).to.be.revertedWith("Only the contract owner may perform this action");
        })

        it("Should revert if removing an unexisting rewards contract", async () => {
            await expect(controller.connect(owner).removeRewardsContract(addr1Address)).to.be.revertedWith("RewardsContractNotFound()");
        })

        it("Should remove a rewards contract", async () => {

            let someRewardsAddress = address(addr1);

            await controller.connect(owner).addRewardsContract(rewards.address);

            await controller.connect(owner).addRewardsContract(someRewardsAddress);

            expect(await controller.rewardsContracts(0)).to.be.equal(rewards.address);

            expect(await controller.rewardsContracts(1)).to.be.equal(someRewardsAddress);

            await controller.connect(owner).removeRewardsContract(rewards.address);

            expect(await controller.rewardsContracts(0)).to.be.equal(someRewardsAddress);

            let rewardsAuth = await controller.rewardsContractsAuth(rewards.address);

            let someRewardsAuth = await controller.rewardsContractsAuth(someRewardsAddress);

            expect(rewardsAuth.isAuth).to.be.false;

            expect(someRewardsAuth.isAuth).to.be.true;
        })
    })

    describe("Testing bulkAddRewardsContract()", async () => {
        before(initialize);

        it("Should only be callable by the owner", async () => {
            await expect(controller.connect(addr1).bulkAddRewardsContract([rewards.address])).to.be.revertedWith("Only the contract owner may perform this action");
        })

        it("Should add multiple rewards contracts", async () => {
            await controller.connect(owner).bulkAddRewardsContract([rewards.address, rewards1.address, rewards2.address]);

            expect(await controller.rewardsContracts(0)).to.be.equal(rewards.address);

            expect(await controller.rewardsContracts(1)).to.be.equal(rewards1.address);

            expect(await controller.rewardsContracts(2)).to.be.equal(rewards2.address);
        })

        it("Should not allow to add duplicated rewards contracts", async () => {
            await expect(controller.connect(owner).bulkAddRewardsContract([rewards2.address])).to.be.revertedWith("RewardsContractAlreadyExists()");

            await expect(controller.connect(owner).bulkAddRewardsContract([rewards.address, rewards1.address, rewards2.address])).to.be.revertedWith("RewardsContractAlreadyExists()");
        })
    })

    describe("Testing bulkRemoveRewardsContract()", async () => {
        before(initialize);

        it("Should only be callable by the owner", async () => {
            await expect(controller.connect(addr1).bulkRemoveRewardsContract([rewards.address])).to.be.revertedWith("Only the contract owner may perform this action");
        })

        it("Should remove multiple rewards contracts", async () => {
            await controller.connect(owner).bulkAddRewardsContract([rewards.address, rewards1.address, rewards2.address]);

            expect(await controller.rewardsContracts(0)).to.be.equal(rewards.address);

            expect(await controller.rewardsContracts(1)).to.be.equal(rewards1.address);

            expect(await controller.rewardsContracts(2)).to.be.equal(rewards2.address);

            await controller.connect(owner).bulkRemoveRewardsContract([rewards.address, rewards1.address]);

            expect(await controller.rewardsContracts(0)).to.be.equal(rewards2.address);
        })

        it("Should revert if removing unexisting rewards contracts", async () => {
            await expect(controller.connect(owner).bulkRemoveRewardsContract([rewards2.address, rewards1.address, rewards.address])).to.be.revertedWith("RewardsContractNotFound()");

            expect(await controller.rewardsContracts(0)).to.be.equal(rewards2.address);
        })
    })

    describe("Testing rewardTrustableStatus()", async () => {
        before(initialize);

        it("Should return a list of rewards address that does not have the controller as trusted", async () => {
            expect(await controller.rewardTrustableStatus()).to.deep.equal([]);

            await controller.connect(owner).addRewardsContract(rewards.address)
            await controller.connect(owner).addRewardsContract(rewards1.address)

            expect(await controller.rewardTrustableStatus()).to.deep.equal([rewards.address, rewards1.address]);

            await rewards.connect(owner).addTrustedController(controller.address);

            expect(await controller.rewardTrustableStatus()).to.deep.equal([rewards1.address, ethers.constants.AddressZero]);

            await rewards1.connect(owner).addTrustedController(controller.address)

            expect(await controller.rewardTrustableStatus()).to.deep.equal([ethers.constants.AddressZero, ethers.constants.AddressZero]);

            await rewards.connect(owner).removeTrustedController(controller.address);

            expect(await controller.rewardTrustableStatus()).to.deep.equal([rewards.address, ethers.constants.AddressZero]);
        })
    })

    describe.only("Testing notifyAllDeposit", async () => {
        before(initialize);

        it("Should only revert if wrong declaration is passed", async () => {


            let hashedWrongDeclaration = ethers.utils.keccak256(ethers.utils.solidityPack(["string"], ["wrong declaration"]))

            let signature = await owner.signMessage(hashedWrongDeclaration);

            await expect(controller.connect(owner).notifyAllDeposit(signature)).to.be.revertedWith("WrongTermsOfUse");
        })

        it("Should not revert even if there is no rewards contracts set", async () => {

            console.log("testing declaration: ", declaration);

            let hashedDeclaration = ethers.utils.keccak256(ethers.utils.solidityPack(["string"], [declaration]))

            console.log("testgin hashed declaration: ", hashedDeclaration);

            let signature = await owner.signMessage(hashedDeclaration);

            console.log("testgin signature: ", signature);

            console.log("owner address: ", address(owner));

            await expect(controller.connect(owner).notifyAllDeposit(signature)).not.to.be.reverted;
        })

        it("Should notify deposit in all rewards contracts known", async () => {
            const rewardAmount = 3000000;
            await setReward(rewardAmount / 3, days(90), rewards);

            await setReward(rewardAmount / 3, days(90), rewards1);

            await setReward(rewardAmount / 3, days(90), rewards2);

            await newoToken.connect(treasury).transfer(address(addr1), parseNewo(1000));

            await veNewo
                .connect(addr1)
            ["deposit(uint256,address,uint256)"](
                parseNewo(1000),
                address(addr1),
                years(2)
            )

            await controller.connect(owner).bulkAddRewardsContract([rewards.address, rewards1.address, rewards2.address])

            // Explosive test: To "fix" just comment the line bellow and uncomment the other one
            // await controller.connect(addr2).notifyAllDeposit(declaration);
            await controller.connect(addr1).notifyAllDeposit(declaration);

            let userVeNewoUnlockDate = await veNewo.unlockDate(address(addr1))

            let rewardsDueDate = await rewards.getDueDate(address(addr1))

            let rewards1DueDate = await rewards1.getDueDate(address(addr1))

            let rewards2DueDate = await rewards2.getDueDate(address(addr1))

            expect(userVeNewoUnlockDate).to.be.equal(rewardsDueDate);

            expect(userVeNewoUnlockDate).to.be.equal(rewards1DueDate);

            expect(userVeNewoUnlockDate).to.be.equal(rewards2DueDate);
        })
    })

    describe("Testing getAllRewards()", async () => {
        before(initialize);

        it("Should only revert if wrong declaration is passed", async () => {
            await expect(controller.connect(owner).getAllRewards("wrong declaration")).to.be.revertedWith("WrongTermsOfUse");
        })

        it("Should not revert even if there is no rewards contracts set", async () => {
            await expect(controller.connect(addr1).getAllRewards(declaration)).not.to.be.reverted;
        })

        it("Should get all rewards from all rewards contracts known", async () => {
            const rewardAmount = 3000000;
            await setReward(rewardAmount / 3, days(90), rewards);

            await setReward(rewardAmount / 3, days(90), rewards1);

            await setReward(rewardAmount / 3, days(90), rewards2);

            await newoToken.connect(treasury).transfer(address(addr1), parseNewo(1000));

            const { balNewo: balNewoAddr1Before } = await checkBalances(addr1);

            await veNewo
                .connect(addr1)
            ["deposit(uint256,address,uint256)"](
                parseNewo(1000),
                address(addr1),
                years(2)
            )

            await controller.connect(owner).bulkAddRewardsContract([rewards.address, rewards1.address, rewards2.address])

            // Thought we would need this.
            // await rewards.connect(owner).addTrustedController(controller.address);
            // await rewards1.connect(owner).addTrustedController(controller.address);
            // await rewards2.connect(owner).addTrustedController(controller.address);

            await controller.connect(addr1).notifyAllDeposit(declaration);

            await timeTravel(days(90));

            await controller.connect(addr1).getAllRewards(declaration);

            const { balNewo: balNewoAddr1After } = await checkBalances(addr1);
        })
    })

    describe("Testing exitAllRewards()", async () => {
        before(initialize);
        it("Should only revert if wrong declaration is passed", async () => {
            await expect(controller.connect(owner).exitAllRewards("wrong declaration")).to.be.revertedWith("WrongTermsOfUse");
        })

        it("Should not revert even if there is no rewards contracts set", async () => {
            await expect(controller.connect(addr1).exitAllRewards(declaration)).not.to.be.reverted;
        })
    })

    async function setReward(rewardAmount: number, distributionPeriod: number, rewardsContract: Rewards) {

        const tokensToReward = parseNewo(rewardAmount);

        console.log("\n Setting distribution reward");

        await rewardsContract
            .connect(owner)
            .setRewardsDuration(distributionPeriod)

        await newoToken
            .connect(treasury)
            .transfer(address(rewardsContract), tokensToReward);

        await rewardsContract
            .connect(treasury)
            .notifyRewardAmount(tokensToReward);

        await rewardsContract
            .connect(owner)
            .addTrustedController(controller.address)

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

