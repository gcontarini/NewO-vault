// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Owned} from "./Owned.sol";
import {IRewards} from "./interfaces/IRewards.sol";

contract RewardsController is Owned {
    // Sum to 32 bytes
    struct RewardsContract {
        address rewardsContractAddress;
        bool isAuth;
        uint88 index;
    }

    /* ========== STATE VARIABLES ========== */

    address[] public rewardsContracts;
    mapping(address => RewardsContract) public rewardsContractsAuth;

    mapping(address => bool)[] public signedConditions;
    uint public indexSigned = 0;

    /* ========== CONSTRUCTOR ========== */

    constructor(address owner_) Owned(owner_) {
        signedConditions.push();
    }

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

    /**
     * @notice Sign the conditions
     */
    function signConditions() public {
        if (signedConditions[indexSigned][msg.sender])
            revert ConditionsAlreadySigned();
        signedConditions[indexSigned][msg.sender] = true;

        emit ConditionsSigned(msg.sender);
    }

    /**
     * @notice Reset the sign conditions by creating a new mapping,
     * points to the new mapping by incrementing indexSigned.
     */
    function updateSignConditions() public onlyOwner {
        signedConditions.push();
        indexSigned++;

        emit ConditionsUpdated();
    }

    /* ========== IRewards ========== */

    /**
     * @notice Get all rewards from all rewards contracts
     * @dev This must never revert
     */
    function getAllRewards() public onlySigned {
        for (uint256 i = 0; i < rewardsContracts.length; ) {
            IRewards rewardsContract = IRewards(rewardsContracts[i]);
            rewardsContract.getRewards(msg.sender);

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
    function notifyAllDeposit() public onlySigned {
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
     * @notice Check if conditions are signed
     */
    modifier onlySigned() {
        if (!signedConditions[indexSigned][msg.sender])
            revert ConditionsNotSigned();
        _;
    }

    /* ========== EVENTS ========== */

    event RewardsContractAdded(address indexed rewardsContractAddress);
    event RewardsContractRemoved(address indexed rewardsContractAddress);
    event ConditionsSigned(address indexed user);
    event ConditionsUpdated();

    /* ========== ERRORS ========== */

    error RewardsContractNotFound();
    error RewardsContractAlreadyExists();
    error ConditionsAlreadySigned();
    error ConditionsNotSigned();
}
