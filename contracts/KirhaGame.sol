// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "./KirhaResources.sol";

/**
 * @title KirhaGame
 * @notice Contrat principal du jeu To-Kirha.
 *
 * Flux de sauvegarde :
 *   1. Le serveur (ou le joueur via signature du serveur) appelle batchMintResources
 *   2. Le contrat vérifie la signature ECDSA du serveur (signer autorisé)
 *   3. Il appelle KirhaResources.mintBatch pour minéter les ressources récoltées
 *
 * Sécurité :
 *   - Chaque sauvegarde inclut un nonce unique par joueur → anti-replay
 *   - Seul le signer autorisé peut produire des signatures valides
 */
contract KirhaGame is Ownable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    KirhaResources public immutable resources;

    /** Signataire autorisé (backend To-Kirha) */
    address public signer;

    /** Nonce anti-replay par joueur */
    mapping(address => uint256) public nonces;

    event ResourcesMinted(address indexed player, uint256[] ids, uint256[] amounts, uint256 nonce);
    event SignerUpdated(address indexed newSigner);

    constructor(
        address initialOwner,
        address _resources,
        address _signer
    ) Ownable(initialOwner) {
        resources = KirhaResources(_resources);
        signer = _signer;
    }

    // --------------------------------------------------------
    // Administration
    // --------------------------------------------------------

    function setSigner(address _signer) external onlyOwner {
        signer = _signer;
        emit SignerUpdated(_signer);
    }

    // --------------------------------------------------------
    // Sauvegarde on-chain
    // --------------------------------------------------------

    /**
     * @notice Mint groupé des ressources récoltées off-chain.
     *
     * @param ids       IDs ERC-1155 à minter (1-50)
     * @param amounts   Quantités correspondantes
     * @param nonce     Nonce du joueur (doit correspondre à nonces[msg.sender])
     * @param signature Signature ECDSA du signer : keccak256(player, ids, amounts, nonce, chainId)
     */
    function batchMintResources(
        uint256[] calldata ids,
        uint256[] calldata amounts,
        uint256 nonce,
        bytes calldata signature
    ) external {
        require(ids.length > 0, "KirhaGame: empty batch");
        require(ids.length == amounts.length, "KirhaGame: length mismatch");
        require(nonce == nonces[msg.sender], "KirhaGame: invalid nonce");

        // Vérifie la signature du backend
        bytes32 hash = keccak256(
            abi.encodePacked(
                msg.sender,
                ids,
                amounts,
                nonce,
                block.chainid
            )
        );
        bytes32 ethHash = hash.toEthSignedMessageHash();
        address recovered = ethHash.recover(signature);
        require(recovered == signer, "KirhaGame: invalid signature");

        // Incrémente le nonce avant mint (protection re-entrancy)
        nonces[msg.sender]++;

        // Mint les ressources
        resources.mintBatch(msg.sender, ids, amounts);

        emit ResourcesMinted(msg.sender, ids, amounts, nonce);
    }

    /**
     * @notice Retourne le nonce actuel d'un joueur (pour construire la signature côté backend)
     */
    function getNonce(address player) external view returns (uint256) {
        return nonces[player];
    }
}
