import { expect } from "chai";
import { ethers } from "hardhat";
import { VeNewO, XNewO, Rewards, VeNewO__factory , XNewO__factory, Rewards__factory  } from '../typechain'
import { Signer } from "ethers";

const lPAddress = "0xc08ED9a9ABEAbcC53875787573DC32Eee5E43513";
const newoTokenAddress = "0x98585dFc8d9e7D48F0b1aE47ce33332CF4237D96";

describe("Deployment tests", function () {
    
    let VeNewo: VeNewO__factory;
    let XNewo: XNewO__factory;
    let Rewards: Rewards__factory;
    
    let rewards: Rewards;
    let xNewo: XNewO;
    let veNewo: VeNewO;

    let owner: Signer;
    let treasury: Signer;

    before(async () => {
        VeNewo = await ethers.getContractFactory("VeNewO");
        Rewards = await ethers.getContractFactory("Rewards");
        XNewo = await ethers.getContractFactory("XNewO");
        
        const signers = await ethers.getSigners();
        owner = signers[0];
        treasury = signers[1];
    })

    beforeEach(async () => {
        const ownerAddress = await owner.getAddress();
        const treasuryAddress = await treasury.getAddress();
        veNewo = await VeNewo.deploy(ownerAddress, newoTokenAddress, 604800, 7776000, 94608000, 2, 15, 5, 86400);
        await veNewo.deployed();
        rewards = await Rewards.deploy(ownerAddress, veNewo.address, treasuryAddress, newoTokenAddress);
        await rewards.deployed();
        xNewo = await XNewo.deploy(ownerAddress, lPAddress, newoTokenAddress, veNewo.address, ownerAddress);
    })

   describe("Name, symbol and decimals tests", async () => {        
        it("veToken should have correct name and symbol and decimal", async () => {
            const name = await veNewo.name();
            const symbol = await veNewo.symbol();
            const decimals = await veNewo.decimals();
            
            expect(name).to.equal("veNewO")
            expect(symbol).to.equal("veNWO")
            expect(decimals).to.equal(18)
        });

        it("xNewo should have correct name and symbol and decimal", async () => {
            const name = await xNewo.name();
            const symbol = await xNewo.symbol();
            const decimals = await xNewo.decimals();
            
            expect(name).to.equal("xNewO")
            expect(symbol).to.equal("xNWO")
            expect(decimals).to.equal(18)
        });
    })

   describe("Testing ownership of the contracts", () => {
        it("veVault should have the right owner", async () => {
            const ownerAddress = await owner.getAddress();
            const Owner = await veNewo.owner();
            expect(Owner).to.equal(ownerAddress);
        })

        it("xNewOVault should have the right owner", async () => {
            const ownerAddress = await owner.getAddress()
            const Owner = await xNewo.owner();
            expect(Owner).to.equal(ownerAddress);
        })
        
        it("Rewards should have the right owner", async () => {
            const ownerAddress = await owner.getAddress()
            const Owner = await rewards.owner();
            expect(Owner).to.equal(ownerAddress);
        })
    })

   describe("Testing assets", () => {
       it("veVault should have Newo as underlying asset", async () => {
           const assetAddress = await veNewo.asset()
           expect(assetAddress).to.equal(newoTokenAddress);
       })
       it("lpVault should have sushi Lp token as underlying asset", async () => {
           const assetAddress = await xNewo.asset();
           expect(assetAddress).to.equal(lPAddress);
       })
   })

   describe("Testing Rewards contract constructor", () => {
       it("Rewards should look to veVault contract", async () => {
           const address = await rewards.getVaultAddress();
           expect(address).to.equal(veNewo.address);
       })
       it("Rewards distribuition should come from treasury", async () => {
           const treasuryAddress = await treasury.getAddress();
           const rewardAddress = await rewards.rewardsDistribution();
           expect(rewardAddress).to.equal(treasuryAddress)
       })
       it("Rewards should be in Newo", async () => {
           const rewardAddress = await rewards.rewardsToken();
           expect(rewardAddress).to.equal(newoTokenAddress);
       })
   })
});