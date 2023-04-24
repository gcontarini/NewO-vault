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
    let rewards3: Rewards;
    let controller: RewardsController;

    let owner: Signer;
    let addr1: Signer;
    let addr2: Signer;
    let treasury: Signer;

    let ownerAddress: string;
    let treasuryAddress: string;
    let addr1Address: string;

    let declaration: string;
    let signatureOwner: string;
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
        signatureOwner = await owner.signMessage(ethers.utils.arrayify(hashedDeclaration));
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

        rewards3 = await Rewards.deploy(
            ownerAddress,
            veNewo.address,
            TreasuryAddress,
            newoTokenAddress
        );
        await rewards3.deployed();

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
            await expect(controller.connect(addr1).updateLegalDeclaration(declaration)).to.be.revertedWith("NotOwner()");

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
            await expect(controller.connect(addr1).addRewardsContract(rewards.address)).to.be.revertedWith("NotOwner()");

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
            await expect(controller.connect(addr1).removeRewardsContract(rewards.address)).to.be.revertedWith("NotOwner()");
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
            await expect(controller.connect(addr1).bulkAddRewardsContract([rewards.address])).to.be.revertedWith("NotOwner()");
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
            await expect(controller.connect(addr1).bulkRemoveRewardsContract([rewards.address])).to.be.revertedWith("NotOwner()");
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

    describe("Testing depositUserStatus()", async () => {
        before(initialize);

        it("Should return rewards and rewards1 addresses", async () => {
            const rewardAmount = 3000000;
            await setReward(rewardAmount / 3, days(180), rewards);

            await setReward(rewardAmount / 3, days(180), rewards1);

            await newoToken.connect(treasury).transfer(address(addr1), parseNewo(1000));

            await veNewo
                .connect(addr1)
            ["deposit(uint256,address,uint256)"](
                parseNewo(1000),
                address(addr1),
                days(180)
            )

            await controller.connect(owner).bulkAddRewardsContract([rewards.address, rewards1.address])

            // await controller.connect(addr1).notifyAllDeposit(signatureAddr1);

            expect(await controller.connect(addr1).depositUserStatus(address(addr1))).to.deep.equal([rewards.address, rewards1.address]);
        })

        it("Should return rewards2 address", async () => {
            const rewardAmount = 3000000;

            await controller.connect(addr1).notifyAllDeposit(signatureAddr1);

            await setReward(rewardAmount / 3, days(180), rewards2);

            await controller.connect(owner).bulkAddRewardsContract([rewards2.address])

            expect(await controller.connect(addr1).depositUserStatus(address(addr1))).to.deep.equal([rewards2.address, ethers.constants.AddressZero, ethers.constants.AddressZero]);
        })

        it("Should return an array of NULL after notifying", async () => {
            await controller.connect(addr1).notifyAllDeposit(signatureAddr1);

            expect(await controller.connect(addr1).depositUserStatus(address(addr1))).to.deep.equal([ethers.constants.AddressZero, ethers.constants.AddressZero, ethers.constants.AddressZero]);
        })
    })

    describe("Testing notifyAllDeposit", async () => {
        before(initialize);

        it("Should only revert if wrong declaration is passed", async () => {
            let hashedWrongDeclaration = ethers.utils.solidityKeccak256(["string"], ["wrong declaration"])

            let wrongSignature = await owner.signMessage(ethers.utils.arrayify(hashedWrongDeclaration))

            await expect(controller.connect(owner).notifyAllDeposit(wrongSignature)).to.be.revertedWith("WrongTermsOfUse");
        })

        it("Should not revert even if there is no rewards contracts set", async () => {
            await expect(controller.connect(owner).notifyAllDeposit(signatureOwner)).not.to.be.reverted;
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

            await controller.connect(addr1).notifyAllDeposit(signatureAddr1);

            let rewardsIsRegistered = await rewards.isRegistered(address(addr1))

            let rewards1IsRegistered = await rewards1.isRegistered(address(addr1))

            let rewards2IsRegistered = await rewards2.isRegistered(address(addr1))

            expect(rewardsIsRegistered).to.be.true;
            expect(rewards1IsRegistered).to.be.true;
            expect(rewards2IsRegistered).to.be.true;

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

        it("Should only revert if wrong declaration is passed or the signer is not the caller", async () => {
            let hashedWrongDeclaration = ethers.utils.solidityKeccak256(["string"], ["wrong declaration"])

            let wrongSignature = await owner.signMessage(ethers.utils.arrayify(hashedWrongDeclaration))

            await expect(controller.connect(owner).getAllRewards(wrongSignature)).to.be.revertedWith("WrongTermsOfUse");

            await expect(controller.connect(addr1).getAllRewards(signatureAddr2)).to.be.revertedWith("WrongTermsOfUse");
        })

        it("Should not revert even if there is no rewards contracts set", async () => {
            await expect(controller.connect(owner).getAllRewards(signatureOwner)).not.to.be.reverted;
        })

        it("Should get all rewards from all rewards contracts known", async () => {
            const rewardAmount = 1000000;

            const totalRewards = (parseNewo(rewardAmount) as BigNumber).mul(3)

            await setReward(rewardAmount, days(90), rewards);

            await setReward(rewardAmount, days(90), rewards1);

            await setReward(rewardAmount, days(90), rewards2);

            await newoToken.connect(treasury).transfer(address(addr1), parseNewo(1000));

            await controller.connect(owner).bulkAddRewardsContract([rewards.address, rewards1.address, rewards2.address])

            await veNewo
                .connect(addr1)
            ["deposit(uint256,address,uint256)"](
                parseNewo(1000),
                address(addr1),
                years(2)
            )

            const { balNewo: balNewoAddr1Before } = await checkBalances(addr1);

            await controller.connect(addr1).notifyAllDeposit(signatureAddr1);

            await timeTravel(days(91));

            await controller.connect(addr1).getAllRewards(signatureAddr1);

            const { balNewo: balNewoAddr1After } = await checkBalances(addr1);

            const balaceDiff = (balNewoAddr1After as BigNumber).sub(balNewoAddr1Before as BigNumber)

            // we are accepting +/- 0.001% rouding errors
            const lowerBound = (totalRewards as BigNumber).mul(99999).div(100000);
            const upperBound = (totalRewards as BigNumber).mul(100001).div(100000);

            expect(balaceDiff).to.be.gte(lowerBound).and.lte(upperBound)
        })

        it("Should not revert if just one rewards contract is set and the others have no more rewards to distribute", async () => {
            const rewardAmount = parseNewo(100000);;

            // Setting rewards again for first contract
            await rewards
                .connect(owner)
                .setRewardsDuration(days(10))

            await newoToken
                .connect(treasury)
                .transfer(address(rewards), rewardAmount);

            await rewards
                .connect(treasury)
                .notifyRewardAmount(rewardAmount);

            await timeTravel(days(91));

            await controller.connect(addr1).getAllRewards(signatureAddr1);

            await checkBalances(addr1)

            await expect(controller.connect(addr1).getAllRewards(signatureAddr1)).not.to.be.reverted;

            // Set another rewards contract but does not set it with rewards

            await controller.connect(owner).addRewardsContract(rewards3.address)

            await rewards3.connect(owner).addTrustedController(controller.address)

            await timeTravel(days(90));

            await expect(controller.connect(addr1).getAllRewards(signatureAddr1)).not.to.be.reverted;
        })
    })

    describe("Testing getAllRewards() edge cases", async () => {
        before(initialize);

        // 1. User has veTokens
        // 2. Notify rewards
        // 3. Pass some time
        // 4. Notify again to account rewards but without claiming them (does this make sense?)
        // 5. Unlock date for veTokens arrives
        // 6. User unstake its veTokens
        // 7. User tries to claim rewards
        // 8. Maybe it'll revert with DivisionByZero error'

        it("Should not revert if user has unlocked his veNewo and tries to claim rewards", async () => {
            const rewardAmount = 1000000;

            await setReward(rewardAmount, days(90), rewards);

            await newoToken.connect(treasury).transfer(address(addr1), parseNewo(1000));

            await veNewo
                .connect(addr1)
            ["deposit(uint256,address,uint256)"](
                parseNewo(1000),
                address(addr1),
                years(2)
            )

            await controller.connect(owner).bulkAddRewardsContract([rewards.address])

            await controller.connect(addr1).notifyAllDeposit(signatureAddr1);

            await timeTravel(days(30));

            await controller.connect(addr1).notifyAllDeposit(signatureAddr1);

            await timeTravel(years(2));

            await veNewo.connect(addr1).exit();

            await checkBalances(addr1)

            await expect(controller.connect(addr1).getAllRewards(signatureAddr1)).not.to.be.reverted;

            await checkBalances(addr1)
        })
    })

    describe("Testing getAllRewards() edge cases", async () => {
        before(initialize);

        // 1. User has veTokens
        // 2. Notify rewards
        // 3. Pass some time
        // 4. Notify again to account rewards but without claiming them
        // 5. Unlock date for veTokens arrives
        // 6. User doesnt unstake its veTokens but they can be unstaked
        // 7. User tries to claim rewards
        // 8. What will happen?

        it("Should not revert if user's veNewo unlock date arrives and tries to claim rewards", async () => {
            const rewardAmount = 1000000;

            await setReward(rewardAmount, days(90), rewards);

            await newoToken.connect(treasury).transfer(address(addr1), parseNewo(1000));

            await veNewo
                .connect(addr1)
            ["deposit(uint256,address,uint256)"](
                parseNewo(1000),
                address(addr1),
                years(2)
            )

            await controller.connect(owner).bulkAddRewardsContract([rewards.address])

            await controller.connect(addr1).notifyAllDeposit(signatureAddr1);

            await timeTravel(days(30));

            await controller.connect(addr1).notifyAllDeposit(signatureAddr1);

            await timeTravel(years(2));

            await checkBalances(addr1)

            await expect(controller.connect(addr1).getAllRewards(signatureAddr1)).not.to.be.reverted;

            await checkBalances(addr1)
        })
    })

    describe("Testing getAllRewards() timestamp edge case", async () => {
        before(initialize);

        // 1. User one does deposit and noiftyAllDeposit on the same transaction while user two only do deposit on this transaction.
        // 2. User two does notifyAllDeposit on the next block.

        it("User one should earn more rewards case it notified earlier", async () => {
            const rewardAmount = 1000000;

            await setReward(rewardAmount, days(90), rewards);

            await controller.connect(owner).bulkAddRewardsContract([rewards.address])

            await newoToken.connect(treasury).transfer(address(addr2), parseNewo(1000));

            await hre.network.provider.send("evm_setAutomine", [false]);

            await hre.network.provider.send("evm_setIntervalMining", [0]);

            await veNewo
                .connect(addr1)
            ["deposit(uint256,address,uint256)"](
                parseNewo(1000),
                address(addr1),
                years(2)
            )

            await veNewo
                .connect(addr2)
            ["deposit(uint256,address,uint256)"](
                parseNewo(1000),
                address(addr2),
                years(2)
            )

            await controller.connect(addr1).notifyAllDeposit(signatureAddr1);

            // one second
            await hre.network.provider.send("evm_mine");

            await controller.connect(addr2).notifyAllDeposit(signatureAddr2);

            // one second
            await hre.network.provider.send("evm_mine");

            await timeTravel(days(91));

            await controller.connect(addr1).getAllRewards(signatureAddr1);

            await controller.connect(addr2).getAllRewards(signatureAddr2);

            // one second
            await hre.network.provider.send("evm_mine");

            const { balNewo: balNewoAddr1 } = await checkBalances(addr1);

            const { balNewo: balNewoAddr2 } = await checkBalances(addr2);

            expect(balNewoAddr1).to.be.gt(balNewoAddr2);

            let balRewardDiff = (balNewoAddr1 as BigNumber).sub(balNewoAddr2 as BigNumber);

            let rewardsPerSecond = await rewards.rewardRate();

            let expectedRewards = (rewardsPerSecond as BigNumber).div(2)

            // we are accepting +/- 0.001% rouding errors
            const lowerBound = (expectedRewards as BigNumber).mul(99999).div(100000);
            const upperBound = (expectedRewards as BigNumber).mul(100001).div(100000);

            expect(balRewardDiff).to.be.gte(lowerBound).and.lte(upperBound)
        })
    })

    describe("Testing exitAllRewards()", async () => {
        before(initialize);
        it("Should revert if wrong declaration is passed or the signer is not the caller", async () => {
            let hashedWrongDeclaration = ethers.utils.solidityKeccak256(["string"], ["wrong declaration"])

            let wrongSignature = await owner.signMessage(ethers.utils.arrayify(hashedWrongDeclaration))

            await expect(controller.connect(owner).exitAllRewards(wrongSignature)).to.be.revertedWith("WrongTermsOfUse");

            await expect(controller.connect(addr1).exitAllRewards(signatureAddr2)).to.be.revertedWith("WrongTermsOfUse");
        })

        it("Should not revert if there is no rewards contracts set", async () => {
            await expect(controller.connect(addr1).exitAllRewards(signatureAddr1)).not.to.be.reverted;
        })

        it("Should revert is user's grace period is not over and collect all rewards and exit from veNewo if user grace period is over", async () => {

            const rewardAmount = 1000000;

            const totalRewards = (parseNewo(rewardAmount) as BigNumber).mul(3)

            await setReward(rewardAmount, days(90), rewards);

            await setReward(rewardAmount, days(90), rewards1);

            await setReward(rewardAmount, days(90), rewards2);

            await newoToken.connect(treasury).transfer(address(addr1), parseNewo(1000));

            const { balNewo: intitialNewoBal } = await checkBalances(addr1);

            await veNewo
                .connect(addr1)
            ["deposit(uint256,address,uint256)"](
                parseNewo(1000),
                address(addr1),
                years(2)
            )

            const { balNewo: balNewoAddr1Before } = await checkBalances(addr1);

            await controller.connect(owner).bulkAddRewardsContract([rewards.address, rewards1.address, rewards2.address])

            await controller.connect(addr1).notifyAllDeposit(signatureAddr1);

            await timeTravel(years(2));

            await expect(controller.connect(addr1).exitAllRewards(signatureAddr1)).to.be.revertedWith("FundsNotUnlocked");

            // Time travel to after grace period
            await timeTravel(days(8))

            await controller.connect(addr1).exitAllRewards(signatureAddr1);

            const { balNewo: balNewoAddr1After } = await checkBalances(addr1);

            let balaceDiff = (balNewoAddr1After as BigNumber).sub(balNewoAddr1Before as BigNumber)

            balaceDiff = (balNewoAddr1After as BigNumber).sub(intitialNewoBal as BigNumber)

            // we are accepting +/- 0.001% rouding errors
            const lowerBound = (totalRewards as BigNumber).mul(99999).div(100000);
            const upperBound = (totalRewards as BigNumber).mul(100001).div(100000);

            expect(balaceDiff).to.be.gte(lowerBound).and.lte(upperBound)

            const veNewoBalance = await veNewo.balanceOf(address(addr1))

            expect(veNewoBalance).to.be.equal(0)
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

