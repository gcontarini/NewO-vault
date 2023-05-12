// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import {SafeERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

// Inheritance
import {Owned} from "./Owned.sol";

// Custom errors
error NotWhitelisted();
error InsufficientBalance(uint256 available, uint256 required);

/**
 * @title RecoverTokens
 * @notice This contract allows to recover ERC20 and ERC721 tokens
 * that were accidentally sent to this contract.
 * @dev Only owner can recover tokens. Owner can whitelist ERC20
 * tokens to recover. Owner can also recover all balance of an ERC20
 * token.
 */
abstract contract RecoverTokens is Owned {
    using SafeERC20 for IERC20;

    // Only allow recoverERC20 from this list
    mapping(address => bool) public whitelistRecoverERC20;

    /**
     * @notice Added to support to recover ERC20 token within a whitelist
     * @param tokenAddress address of the token to recover
     * @param tokenAmount amount of tokens to recover
     */
    function recoverERC20(
        address tokenAddress,
        uint256 tokenAmount
    ) external onlyOwner {
        _recoverERC20(tokenAddress, tokenAmount);
    }

    /**
     * @notice Added to support to recover all balnce of ERC20 token
     * within a whitelist
     * @param tokenAddress address of the token to recover
     */
    function recoverERC20(address tokenAddress) external onlyOwner {
        _recoverERC20(
            tokenAddress,
            IERC20(tokenAddress).balanceOf(address(this))
        );
    }

    function _recoverERC20(address tokenAddress, uint256 tokenAmount) private {
        if (whitelistRecoverERC20[tokenAddress] == false)
            revert NotWhitelisted();

        uint balance = IERC20(tokenAddress).balanceOf(address(this));
        if (balance < tokenAmount)
            revert InsufficientBalance({
                available: balance,
                required: tokenAmount
            });

        IERC20(tokenAddress).safeTransfer(owner, tokenAmount);
        emit Recovered(tokenAddress, tokenAmount);
    }

    /**
     * @dev It's possible to owner whitelist the underlying token
     * and do some kind of rugpull. To prevent that, it'recommended
     * that owner is a multisig address. Also, it emits an event
     * of changes in the ERC20 whitelist as a safety check.
     * @notice Owner can whitelist an ERC20 to recover it afterwards.
     * Emits and event to notify all users about it
     * @param flag: true to allow recover for the token
     */
    function changeWhitelistRecoverERC20(
        address tokenAddress,
        bool flag
    ) external onlyOwner {
        whitelistRecoverERC20[tokenAddress] = flag;
        emit ChangeWhitelistERC20(tokenAddress, flag);
    }

    /**
     * @notice Added to support to recover ERC721
     */
    function recoverERC721(
        address tokenAddress,
        uint256 tokenId
    ) external onlyOwner {
        IERC721(tokenAddress).safeTransferFrom(address(this), owner, tokenId);
        emit RecoveredNFT(tokenAddress, tokenId);
    }

    /* ========== EVENTS ========== */

    event Recovered(address token, uint256 amount);
    event RecoveredNFT(address tokenAddress, uint256 tokenId);
    event ChangeWhitelistERC20(
        address indexed tokenAddress,
        bool whitelistState
    );
}