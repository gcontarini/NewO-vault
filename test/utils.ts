import { ethers } from "hardhat";
import hre = require("hardhat");
import { BigNumber, BigNumberish, Contract } from "ethers";
import moment from "moment";
import { formatUnits, parseUnits } from "ethers/lib/utils";

/* utils functions */
/**
 * this will time travel to x seconds later
 * @param seconds
 */
export const timeTravel = async (seconds: number) => {
    // get the time right now
    const blockNumBefore = await ethers.provider.getBlockNumber();
    const blockBefore = await ethers.provider.getBlock(blockNumBefore);
    const now = blockBefore.timestamp;

    const future = now + seconds; // some times later
    console.log(`\ttime traveling to: ${moment.unix(future).toDate()}`);
    await hre.network.provider.send("evm_setNextBlockTimestamp", [future]);
    await hre.network.provider.send("evm_mine");
};

/**
 * return the address
 * @param entity signer or contract
 * @returns the address of the entity
 */
export const address = (entity: any) =>
    entity.address ?? ethers.constants.AddressZero;

/**
 * return balance of an address
 * @param tokenContract
 * @returns a function that checks the balance
 */
export const balance = (tokenContract: Contract) => async (entity: any) =>
    await tokenContract.balanceOf(address(entity));

/**
 * return balance of an address
 * @param tokenContract
 * @returns a function that checks the balance
 */
export const assetBalance = (tokenContract: Contract) => async (entity: any) =>
    await tokenContract.assetBalanceOf(address(entity));

/**
 * get seconds for x number of days
 * @param input number of days
 * @returns the epoch
 */
export const days = (input: number) => input * 86400;

/**
 * get seconds for x number of months
 * @param input number of months
 * @returns the epoch
 */
const months = (input: number) => input * 30 * 86400;

/**
 * get seconds for x number of months
 * @param input number of months
 * @returns the epoch
 */
export const years = (input: number) => input * 365 * 86400;

/**
 * parse a number to string
 * @param input
 * @returns
 */
export const toStr = (input: any) => "" + input;

/**
 * parse a token with decimals
 * @param tokenContract
 * @returns a function to parse a number to big number
 */
export const parseToken = async (tokenContract: Contract) => {
    const decimals = await tokenContract.decimals();
    return (input: number) => parseUnits(toStr(input), decimals);
};

/**
 * parse a token with decimals
 * @param tokenContract
 * @returns a function to format a big number to number
 */
export const formatToken = async (tokenContract: Contract) => {
    const decimals = await tokenContract.decimals();
    return (input: BigNumberish) => formatUnits(input, decimals);
};
