// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

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


    /**
     * @notice Get the dueDate for a user. This should be equal to
     * user's veVault unlockDate. If is zero, the user is not registered.
     * @return dueDate that should be the unlockDate of veVault
     * @dev returns 0 if user is not registered
     */
    function getDueDate(address user) external view returns (uint256);

    /**
     * @notice Get registered for rewards status of a user
     * @param user The address of the user
     * @return bool if the user is registered for rewards
     * @dev a user is registered if the dueDate is not zero and
     * the dueDate is equal to the unlockDate of the veVault
     * and due date is not due yet.
     * @dev there's a edge case where the user restaked tokens
     * but kept the same due date. In that case, the user is missing
     * a notify but the function will return true anyway.
     */
    function isRegistered(address user) external view returns (bool);
}
