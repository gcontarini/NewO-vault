// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Owned} from "./Owned.sol";
import {IRewards} from "./interfaces/IRewards.sol";

contract RewardsController is Owned {
    struct RewardsContract {
        address rewardsContractAddress;
        bool isAuth;
        uint88 index;
    }

    address[] public rewardsContracts;
    mapping(address => RewardsContract) public rewardsContractsAuth;

    constructor() {}

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
        uint88 index = rewardsContractsAuth[_rewardsContractAddress].index;
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

    // Not sure about this implementation yet
    // function signMessage() public {}

    /**
     * @notice Get all rewards from all rewards contracts
     * @dev This must never revert
     * TODO add message signing
     */
    function getAllRewards() public {
        for (uint256 i = 0; i < rewardsContracts.length; ) {
            IRewards rewardsContract = IRewards(rewardsContracts[i]);
            rewardsContract.getRewards();

            unchecked {
                i++;
            }
        }
    }

    /**
     * @notice Notify all rewards contracts that a deposit has been made
     * @dev This function should be called after a deposit has been made
     * @dev This must never revert
     * TODO add message signing
     */
    function notifyAllDeposit() public {
        for (uint256 i = 0; i < rewardsContracts.length; ) {
            IRewards rewardsContract = IRewards(rewardsContracts[i]);
            rewardsContract.notifyDeposit();

            unchecked {
                i++;
            }
        }
    }

    // LP contracts also have deposit. We need to think about it.

    event RewardsContractAdded(address indexed rewardsContractAddress);
    event RewardsContractRemoved(address indexed rewardsContractAddress);

    error RewardsContractNotFound();
    error RewardsContractAlreadyExists();
}
