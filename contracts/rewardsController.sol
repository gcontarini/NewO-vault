// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Owned} from "./Owned.sol";
import {IRewards} from "./interfaces/IRewards.sol";

import "hardhat/console.sol";

/**
 * @title RewardsController
 * @notice This contract is used to manage the rewards contracts
 * @dev This contract is owned
 */

contract RewardsController is Owned {
    // Sum to 32 bytes
    struct RewardsContract {
        address rewardsContractAddress;
        bool isAuth;
        uint index;
    }

    /* ========== STATE VARIABLES ========== */

    address[] public rewardsContracts;
    mapping(address => RewardsContract) public rewardsContractsAuth;

    /* ========== CONSTRUCTOR ========== */

    constructor(address owner_) Owned(owner_) {}

    /* ========== FUNCTIONS ========== */

    /**
     * @notice Add a new rewards contract to the list of rewards contracts
     * @param _rewardsContractAddress The address of the rewards contract
     */
    function addRewardsContract(
        address _rewardsContractAddress
    ) external onlyOwner {
        if (rewardsContractsAuth[_rewardsContractAddress].isAuth) {
            revert RewardsContractAlreadyExists();
        }

        // Add contract
        rewardsContracts.push(_rewardsContractAddress);

        // Add info about it
        rewardsContractsAuth[_rewardsContractAddress] = RewardsContract({
            rewardsContractAddress: _rewardsContractAddress,
            isAuth: true,
            index: rewardsContracts.length - 1
        });

        emit RewardsContractAdded(_rewardsContractAddress);
    }

    /**
     * @notice Remove a rewards contract from the list of rewards contracts
     * @param _rewardsContractAddress The address of the rewards contract
     * @dev The order of contracts in the array will change.
     */
    function removeRewardsContract(
        address _rewardsContractAddress
    ) external onlyOwner {
        // Check if it exists
        if (!rewardsContractsAuth[_rewardsContractAddress].isAuth) {
            revert RewardsContractNotFound();
        }

        // Get old index and set isAuth to false
        uint index = rewardsContractsAuth[_rewardsContractAddress].index;
        rewardsContractsAuth[_rewardsContractAddress].isAuth = false;

        // Get last contract address
        address lastRewardsContractAddress = rewardsContracts[
            rewardsContracts.length - 1
        ];
        // Move it to the index of the contract to be removed
        rewardsContracts[index] = lastRewardsContractAddress;
        rewardsContracts.pop();

        // Update the index of the moved contract
        rewardsContractsAuth[lastRewardsContractAddress].index = index;

        emit RewardsContractRemoved(_rewardsContractAddress);
    }

    /* ========== IRewards ========== */

    /**
     * @notice Get all rewards from all rewards contracts
     * @dev This must never revert
     */
    function getAllRewards(
        string calldata declaration
    ) public onlyConfirmedTermsOfUse(declaration) {
        for (uint256 i = 0; i < rewardsContracts.length; ) {
            console.log(msg.sender);
            IRewards rewardsContract = IRewards(rewardsContracts[i]);
            rewardsContract.getReward(msg.sender);

            unchecked {
                i++;
            }
        }
    }

    /**
     * @notice Notify all rewards contracts that a deposit has been made
     * @dev This function should be called after a deposit has been made
     * @dev This must never revert
     */
    function notifyAllDeposit(
        string calldata declaration
    ) public onlyConfirmedTermsOfUse(declaration) {
        for (uint256 i = 0; i < rewardsContracts.length; ) {
            IRewards rewardsContract = IRewards(rewardsContracts[i]);
            rewardsContract.notifyDeposit(msg.sender);

            unchecked {
                i++;
            }
        }
    }

    // LP contracts also have deposit. We need to think about it.

    /* ========== MODIFIERS ========== */

    /**
     * @notice Check if the user has confirmed the terms of use
     * @param declaration The declaration of the user
     * @dev The declaration must be exactly the same as the one in the Terms of Use
     */
    modifier onlyConfirmedTermsOfUse(string memory declaration) {
        if (
            keccak256(abi.encodePacked(declaration)) !=
            keccak256(
                abi.encodePacked(
                    "I have read and agree to the Terms and Conditions https://neworder.network/legal"
                )
            )
        ) {
            revert WrongTermsOfUse();
        }
        _;
    }

    /* ========== EVENTS ========== */

    event RewardsContractAdded(address indexed rewardsContractAddress);
    event RewardsContractRemoved(address indexed rewardsContractAddress);

    /* ========== ERRORS ========== */

    error RewardsContractNotFound();
    error RewardsContractAlreadyExists();
    error WrongTermsOfUse();
}
