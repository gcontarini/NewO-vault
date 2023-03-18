// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Owned} from "./Owned.sol";
import {IRewards} from "./interfaces/IRewards.sol";
import {IVeVault} from "./interfaces/IVeVault.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";

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

    address public veTokenAddress;

    /* ========== CONSTRUCTOR ========== */

    constructor(address owner_, address veToken_) Owned(owner_) {
        veTokenAddress = veToken_;
    }

    /* ========== FUNCTIONS ========== */

    /**
     * @notice Add a new rewards contract to the list of rewards contracts
     * @param _rewardsContractAddress The address of the rewards contract
     */
    function addRewardsContract(
        address _rewardsContractAddress
    ) private onlyOwner {
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
     * @notice Add a new rewards contracts to the list of rewards contracts
     * @param _rewardsContractsAddresses The addresses of the rewards contracts
     */
    function bulkAddRewardsContract (
        address[] calldata _rewardsContractsAddresses
    ) private onlyOwner{
        for (uint i; i < _rewardsContractsAddresses.length; i++) {
            addRewardsContract(_rewardsContractsAddresses[i]);
        }
    }

    /**
     * @notice Remove a rewards contract from the list of rewards contracts
     * @param _rewardsContractAddress The address of the rewards contract
     * @dev The order of contracts in the array will change.
     */
    function removeRewardsContract(
        address _rewardsContractAddress
    ) private onlyOwner {
        // Check if it exists
        if (!rewardsContractsAuth[_rewardsContractAddress].isAuth) {
            revert RewardsContractNotFound();
        }

        // Get old index and set isAuth to false
        uint index = rewardsContractsAuth[_rewardsContractAddress].index;

        // Set the rewards contract address to address(0), update the isAuth flag to false and set index to 0
        rewardsContractsAuth[_rewardsContractAddress].rewardsContractAddress = address(0);
        rewardsContractsAuth[_rewardsContractAddress].isAuth = false;
        rewardsContractsAuth[_rewardsContractAddress].index = 0;

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
    * @notice Remove rewards contracts from the list of rewards contracts
    * @param _rewardsContractsAddresses The addresses of the rewards contracts
    * @dev The order of contracts in the array will change.
    */
   function bulkRemoveRewardsContract (
    address[] calldata _rewardsContractsAddresses
    ) private onlyOwner{
        for (uint i; i < _rewardsContractsAddresses.length; i++) {
            removeRewardsContract(_rewardsContractsAddresses[i]);
        }
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

    /**
     * @notice Collect all rewards and exit from  veToken
     * @param declaration The signup declaration of the user
     * @dev This is a convenience hacky function. Can only be used
     * after the user is after its grace period
     */
    function exitAllRewards(
        string calldata declaration
    ) public onlyConfirmedTermsOfUse(declaration) {
        // Collect all rewards
        getAllRewards(declaration);

        IVeVault veVault = IVeVault(veTokenAddress);
        IERC20 underlying = IERC20(veVault.asset());

        // Balance before receiving rewards
        uint256 balanceBefore = underlying.balanceOf(address(this));

        // Controller will receive a reward for kicking off the user
        veVault.withdraw(veVault.balanceOf(msg.sender), msg.sender, msg.sender);

        // Balance after receiving rewards
        uint256 balanceAfter = underlying.balanceOf(address(this));

        // Calculate the amount of rewards to transfer to the user
        uint256 amount = balanceAfter - balanceBefore;
        underlying.transfer(msg.sender, amount);
    }

    /* ========= MODIFIERS ========== */

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
