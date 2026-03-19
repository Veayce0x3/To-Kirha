// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title KirhaCity
 * @notice NFT représentant une ville dans To-Kirha.
 *         tokenId = cityId (séquentiel, commence à 1).
 *         Transférer ce NFT = transférer la totalité de la ville
 *         (ressources, niveaux, $KIRHA in-game stockés dans KirhaGame par cityId).
 *
 *         ownerToCityId est tenu à jour à chaque transfert via _update().
 */
contract KirhaCity is ERC721, Ownable {

    using Strings for uint256;

    /** Seul KirhaGame peut appeler mintCity */
    address public game;

    /** Reverse mapping : wallet → cityId courant (0 si aucune ville) */
    mapping(address => uint256) public ownerToCityId;

    event CityMinted(address indexed owner, uint256 indexed cityId, string pseudo);

    modifier onlyGame() {
        require(msg.sender == game, "KirhaCity: only game");
        _;
    }

    constructor(address initialOwner)
        ERC721("To-Kirha City", "CITY")
        Ownable(initialOwner)
    {}

    // --------------------------------------------------------
    // Administration
    // --------------------------------------------------------

    function setGame(address _game) external onlyOwner {
        game = _game;
    }

    // --------------------------------------------------------
    // Mint (appelé par KirhaGame lors de registerPseudo)
    // --------------------------------------------------------

    function mintCity(
        address to,
        uint256 cityId,
        string calldata pseudo
    ) external onlyGame {
        _mint(to, cityId);
        // ownerToCityId est mis à jour dans _update()
        emit CityMinted(to, cityId, pseudo);
    }

    // --------------------------------------------------------
    // Burn (appelé par KirhaGame lors de adminDeleteCity)
    // --------------------------------------------------------

    function burnCity(uint256 cityId) external onlyGame {
        _burn(cityId);
        // _update() gère automatiquement la mise à zéro de ownerToCityId
    }

    // --------------------------------------------------------
    // Override _update — maintenir ownerToCityId
    // --------------------------------------------------------

    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0)) {
            ownerToCityId[from] = 0;
        }
        if (to != address(0)) {
            ownerToCityId[to] = tokenId;
        }
        return super._update(to, tokenId, auth);
    }

    // --------------------------------------------------------
    // Metadata
    // --------------------------------------------------------

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "KirhaCity: nonexistent token");
        return string(abi.encodePacked(
            "https://veayce0x3.github.io/To-Kirha/api/city/",
            tokenId.toString()
        ));
    }
}
