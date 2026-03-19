// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./KirhaResources.sol";
import "./KirhaToken.sol";

/**
 * @title KirhaGame
 * @notice Contrat principal du jeu To-Kirha.
 *
 * Flux de sauvegarde :
 *   1. Le joueur appelle batchMintResources depuis le frontend
 *   2. Le contrat mint les ressources récoltées off-chain
 *
 * NOTE TESTNET : vérification de signature ECDSA désactivée.
 *   Réactiver avant déploiement mainnet en ajoutant :
 *   - le check ECDSA sur la signature backend
 *   - la gestion des nonces anti-replay
 */
contract KirhaGame is Ownable {

    KirhaResources public immutable resources;
    KirhaToken     public immutable kirhaToken;

    // ── Pseudos ────────────────────────────────────────────────
    mapping(string  => address) private _pseudoToAddress;
    mapping(address => string)  public  playerPseudo;

    event PseudoRegistered(address indexed player, string pseudo);
    event ResourcesMinted(address indexed player, uint256[] ids, uint256[] amounts);
    event KirhaWithdrawn(address indexed player, uint256 amount);
    event KirhaDeposited(address indexed player, uint256 amount);

    constructor(
        address initialOwner,
        address _resources,
        address _kirhaToken
    ) Ownable(initialOwner) {
        resources  = KirhaResources(_resources);
        kirhaToken = KirhaToken(_kirhaToken);
    }

    // --------------------------------------------------------
    // Enregistrement pseudo — unique global on-chain
    // --------------------------------------------------------

    /**
     * @notice Enregistre un pseudo unique pour msg.sender.
     * @param name  3-16 caractères, alphanumérique + underscore
     */
    function registerPseudo(string calldata name) external {
        uint256 len = bytes(name).length;
        require(len >= 3 && len <= 16,            "KirhaGame: invalid name length");
        require(bytes(playerPseudo[msg.sender]).length == 0, "KirhaGame: already registered");
        require(_pseudoToAddress[name] == address(0),        "KirhaGame: pseudo already taken");
        _pseudoToAddress[name]   = msg.sender;
        playerPseudo[msg.sender] = name;
        emit PseudoRegistered(msg.sender, name);
    }

    /** @notice Retourne true si le pseudo est disponible. */
    function isPseudoAvailable(string calldata name) external view returns (bool) {
        return _pseudoToAddress[name] == address(0);
    }

    // --------------------------------------------------------
    // Sauvegarde on-chain (TESTNET — sans vérification signature)
    // --------------------------------------------------------

    /**
     * @notice Mint groupé des ressources récoltées off-chain.
     * @param ids     IDs ERC-1155 à minter (1-50)
     * @param amounts Quantités correspondantes
     */
    function batchMintResources(
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) external {
        require(ids.length > 0, "KirhaGame: empty batch");
        require(ids.length == amounts.length, "KirhaGame: length mismatch");
        resources.mintBatch(msg.sender, ids, amounts);
        emit ResourcesMinted(msg.sender, ids, amounts);
    }

    // --------------------------------------------------------
    // $KIRHA — Retrait (mint vers le joueur)
    // --------------------------------------------------------

    /**
     * @notice Mint des $KIRHA vers le joueur (gains de vente off-chain)
     * @param amount Montant en wei (18 décimales)
     */
    function withdrawKirha(uint256 amount) external {
        require(amount > 0, "KirhaGame: amount must be > 0");
        kirhaToken.mint(msg.sender, amount);
        emit KirhaWithdrawn(msg.sender, amount);
    }
}
