// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

interface IRewards {
    /**
     * @notice Get the rewards for the given user
     * @param user The address of the user
     */
    function getReward(address user) external;

    /**
     * @notice Notify the contract that a deposit has been made by the given user
     * @param user The address of the user who made the deposit
     */
    function notifyDeposit(address user) external;

    /**
     * @notice Check if the given controller is trusted by the reward contract
     * @param controller The address of the controller
     */
    function isControllerTrusted(
        address controller
    ) external view returns (bool);
}
