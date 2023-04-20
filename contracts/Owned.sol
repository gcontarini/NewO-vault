// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

// https://docs.synthetix.io/contracts/source/contracts/Owned
abstract contract Owned {
    address public owner;
    address public nominatedOwner;

    error OwnerCannotBeZero();
    error NewOwnerNotNominated();
    error NotOwner();

    constructor(address _owner) {
        if (_owner == address(0))
            revert OwnerCannotBeZero();
        owner = _owner;
        emit OwnerChanged(address(0), _owner);
    }

    function nominateNewOwner(address _owner) external onlyOwner {
        nominatedOwner = _owner;
        emit OwnerNominated(_owner);
    }

    function acceptOwnership() external {
        if (msg.sender != nominatedOwner)
            revert NewOwnerNotNominated();
        emit OwnerChanged(owner, nominatedOwner);
        owner = nominatedOwner;
        nominatedOwner = address(0);
    }

    modifier onlyOwner {
        _onlyOwner();
        _;
    }

    function _onlyOwner() private view {
        if (msg.sender != owner)
            revert NotOwner();
    }

    event OwnerNominated(address newOwner);
    event OwnerChanged(address oldOwner, address newOwner);
}