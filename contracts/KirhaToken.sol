// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title KirhaToken
 * @notice Token $Kirha — ERC-20 sur Base
 * @dev Mintable uniquement par le contrat KirhaGame (minter autorisé).
 *      L'owner peut ajouter/révoquer des minters.
 */
contract KirhaToken is ERC20, Ownable {

    mapping(address => bool) public minters;

    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);

    modifier onlyMinter() {
        require(minters[msg.sender], "KirhaToken: not a minter");
        _;
    }

    constructor(address initialOwner)
        ERC20("Kirha", "KIRHA")
        Ownable(initialOwner)
    {}

    // --------------------------------------------------------
    // Administration
    // --------------------------------------------------------

    function addMinter(address minter) external onlyOwner {
        minters[minter] = true;
        emit MinterAdded(minter);
    }

    function removeMinter(address minter) external onlyOwner {
        minters[minter] = false;
        emit MinterRemoved(minter);
    }

    // --------------------------------------------------------
    // Mint / Burn
    // --------------------------------------------------------

    /**
     * @notice Mint des $Kirha vers un joueur (appelé par KirhaGame lors d'une vente)
     */
    function mint(address to, uint256 amount) external onlyMinter {
        _mint(to, amount);
    }

    /**
     * @notice Burn des $Kirha depuis un joueur (achat, enchère)
     */
    function burn(address from, uint256 amount) external onlyMinter {
        _burn(from, amount);
    }
}
