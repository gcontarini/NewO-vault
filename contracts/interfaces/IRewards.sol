// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

interface IRewards {
    /**
     * @notice Get the rewards for the given user
     * @param user The address of the user
     */
    function getRewards(address user) external;

    /**
     * @notice Notify the contract that a deposit has been made by the given user
     * @param user The address of the user who made the deposit
     */
    function notifyDeposit(address user) external;
}