// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title KirhaResources
 * @notice Ressources du jeu To-Kirha — ERC-1155
 *
 * IDs ERC-1155 :
 *   Bûcheron   : 1-10
 *   Paysan     : 11-20
 *   Pêcheur    : 21-30
 *   Mineur     : 31-40
 *   Alchimiste : 41-50
 *
 * @dev Mintable/Burnable uniquement par KirhaGame (minter autorisé).
 */
contract KirhaResources is ERC1155, Ownable {

    uint256 public constant MAX_RESOURCE_ID = 50;

    mapping(address => bool) public minters;

    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);

    modifier onlyMinter() {
        require(minters[msg.sender], "KirhaResources: not a minter");
        _;
    }

    constructor(address initialOwner, string memory uri_)
        ERC1155(uri_)
        Ownable(initialOwner)
    {}

    // --------------------------------------------------------
    // Administration
    // --------------------------------------------------------

    function setURI(string memory newUri) external onlyOwner {
        _setURI(newUri);
    }

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
     * @notice Mint une ressource simple
     */
    function mint(address to, uint256 id, uint256 amount) external onlyMinter {
        require(id >= 1 && id <= MAX_RESOURCE_ID, "KirhaResources: invalid id");
        _mint(to, id, amount, "");
    }

    /**
     * @notice Batch mint — appel principal depuis KirhaGame
     * @param to      Adresse du joueur
     * @param ids     IDs ERC-1155 (1-50)
     * @param amounts Quantités correspondantes
     */
    function mintBatch(
        address to,
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) external onlyMinter {
        for (uint256 i = 0; i < ids.length; i++) {
            require(ids[i] >= 1 && ids[i] <= MAX_RESOURCE_ID, "KirhaResources: invalid id");
        }
        _mintBatch(to, ids, amounts, "");
    }

    /**
     * @notice Burn — ex: pour vente sur HDV
     */
    function burn(address from, uint256 id, uint256 amount) external onlyMinter {
        _burn(from, id, amount);
    }

    function burnBatch(
        address from,
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) external onlyMinter {
        _burnBatch(from, ids, amounts);
    }
}
