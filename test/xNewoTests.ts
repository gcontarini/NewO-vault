// import { expect } from "chai";
// import { ethers } from "hardhat";
// import hre = require("hardhat");
// import { VeNewO, XNewO, Rewards, IUniswapV2Pair, VeNewO__factory , XNewO__factory, Rewards__factory, IUniswapV2Pair__factory  } from '../typechain'
// import { Signer, Contract } from "ethers";

// import newOrderABI from "../abi/NewOrderERC20.json";

// const lPAddress = "0xc08ED9a9ABEAbcC53875787573DC32Eee5E43513";
// const newoTokenAddress = "0x98585dFc8d9e7D48F0b1aE47ce33332CF4237D96";
// const TreasuryAddress = "0xdb36b23964FAB32dCa717c99D6AEFC9FB5748f3a";

// describe("xNewo tests", function () {
    
//     let VeNewo: VeNewO__factory;
//     let XNewo: XNewO__factory;
//     let Rewards: Rewards__factory;
//     let lp: IUniswapV2Pair;
//     let newoToken: Contract;

//     let rewards: Rewards;
//     let xNewo: XNewO;
//     let veNewo: VeNewO;

//     let owner: Signer;
//     let addr1: Signer;
//     let treasury: Signer;

//     let ownerAddress: string;
//     let treasuryAddress: string;
//     let addr1Address: string;

//     before(async () => {
//         VeNewo = await ethers.getContractFactory("VeNewO");
//         Rewards = await ethers.getContractFactory("Rewards");
//         XNewo = await ethers.getContractFactory("XNewO");
        
//         lp = await ethers.getContractAt("IUniswapV2Pair", lPAddress);
//         newoToken = await ethers.getContractAt(newOrderABI, newoTokenAddress);

//         const signers = await ethers.getSigners();
//         owner = signers[0];
//         addr1 = signers[1];

//         await hre.network.provider.request({
//             method: "hardhat_impersonateAccount",
//             params: [TreasuryAddress],
//         });

//         // Grant more gas to this sucker
//         await hre.network.provider.send("hardhat_setBalance", [
//             TreasuryAddress,
//             "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
//         ]);

//         treasury = await ethers.getSigner(TreasuryAddress);

//         ownerAddress = await owner.getAddress();
//         addr1Address = await addr1.getAddress();
//         treasuryAddress = await treasury.getAddress();
        
//         veNewo = await VeNewo.deploy(ownerAddress, newoTokenAddress, 604800, 7776000, 94608000, 2, 15, 5, 86400);
//         await veNewo.deployed();
//         rewards = await Rewards.deploy(ownerAddress, veNewo.address, TreasuryAddress, newoTokenAddress);
//         await rewards.deployed();
//         xNewo = await XNewo.deploy(ownerAddress, lPAddress, newoTokenAddress, veNewo.address, ownerAddress);
//         await xNewo.deployed();
//     })

//     beforeEach(async () => {
//         //Transfer some Lp tokens and some Newo to addr1 so he can spend freelly;
//         const numberOfTokens = ethers.utils.parseUnits('1', 18);
//         await newoToken.connect(treasury).transfer(addr1Address, numberOfTokens);
//         await lp.connect(treasury).transfer(addr1Address, numberOfTokens);
//     })

//     describe("Just testing some shit", () => {
//         it("did this sucker received the lp token and the newo token from the address?", async () => {
//             newoToken = await ethers.getContractAt(newOrderABI, newoTokenAddress);
            
//             const testing = await lp.balanceOf(addr1Address);
//             const testing2 = await newoToken.balanceOf(addr1Address);;

//             const numberOfTokens = ethers.utils.parseUnits('1', 18);
    
//             expect(testing).to.equal(numberOfTokens);
//             expect(testing2).to.equal(numberOfTokens);
//         })
//     })

//     // describe("some other shit", () => {
//     //     it("should", () => {

//     //     })
//     // })

// });