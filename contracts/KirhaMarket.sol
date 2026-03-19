// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./KirhaResources.sol";
import "./KirhaToken.sol";

/**
 * @title KirhaMarket
 * @notice HDV on-chain de To-Kirha — Modèle Sunflower Land
 *
 * Flux :
 *   1. Vendeur appelle listResource → envoie ses ERC-1155 au contrat, fixe un prix
 *   2. Acheteur appelle buyResource  → envoie des $KIRHA, reçoit les ressources
 *   3. Taxe de 50% prélevée sur chaque vente → wallet trésorerie
 *   4. Vendeur peut cancelListing pour récupérer ses ressources non vendues
 */
contract KirhaMarket is Ownable, ReentrancyGuard {

    KirhaResources public immutable resources;
    KirhaToken     public immutable kirhaToken;

    /** Wallet qui reçoit les taxes (50% de chaque vente) */
    address public treasury;

    /** Taxe en pourcentage (500 = 50.0%) */
    uint256 public constant TAX_BPS = 5000; // base 10000

    struct Listing {
        address seller;
        uint256 resourceId;
        uint256 quantity;     // quantité restante
        uint256 pricePerUnit; // en $KIRHA wei (18 décimales)
        bool    active;
    }

    uint256 public nextListingId;
    mapping(uint256 => Listing) public listings;

    event ResourceListed(
        uint256 indexed listingId,
        address indexed seller,
        uint256 resourceId,
        uint256 quantity,
        uint256 pricePerUnit
    );
    event ResourceSold(
        uint256 indexed listingId,
        address indexed buyer,
        uint256 quantity,
        uint256 totalPaid,
        uint256 sellerReceives
    );
    event ListingCancelled(uint256 indexed listingId, address indexed seller);
    event TreasuryUpdated(address indexed newTreasury);

    constructor(
        address initialOwner,
        address _resources,
        address _kirhaToken,
        address _treasury
    ) Ownable(initialOwner) {
        resources  = KirhaResources(_resources);
        kirhaToken = KirhaToken(_kirhaToken);
        treasury   = _treasury;
    }

    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    // --------------------------------------------------------
    // Mise en vente
    // --------------------------------------------------------

    /**
     * @notice Liste des ressources ERC-1155 à vendre.
     * @param resourceId   ID ERC-1155 (1-50)
     * @param quantity     Quantité à mettre en vente
     * @param pricePerUnit Prix unitaire en $KIRHA wei
     */
    function listResource(
        uint256 resourceId,
        uint256 quantity,
        uint256 pricePerUnit
    ) external nonReentrant returns (uint256 listingId) {
        require(quantity > 0,      "KirhaMarket: quantity must be > 0");
        require(pricePerUnit > 0,  "KirhaMarket: price must be > 0");

        // Transfert ERC-1155 du vendeur vers le contrat
        resources.safeTransferFrom(msg.sender, address(this), resourceId, quantity, "");

        listingId = nextListingId++;
        listings[listingId] = Listing({
            seller:       msg.sender,
            resourceId:   resourceId,
            quantity:     quantity,
            pricePerUnit: pricePerUnit,
            active:       true
        });

        emit ResourceListed(listingId, msg.sender, resourceId, quantity, pricePerUnit);
    }

    // --------------------------------------------------------
    // Achat
    // --------------------------------------------------------

    /**
     * @notice Achète des ressources depuis un listing.
     * @param listingId ID du listing
     * @param quantity  Quantité à acheter (≤ disponible)
     */
    function buyResource(uint256 listingId, uint256 quantity) external nonReentrant {
        Listing storage l = listings[listingId];
        require(l.active,              "KirhaMarket: listing not active");
        require(quantity > 0,          "KirhaMarket: quantity must be > 0");
        require(quantity <= l.quantity,"KirhaMarket: not enough stock");
        require(msg.sender != l.seller,"KirhaMarket: cannot buy own listing");

        uint256 totalCost     = quantity * l.pricePerUnit;
        uint256 taxAmount     = (totalCost * TAX_BPS) / 10000;
        uint256 sellerAmount  = totalCost - taxAmount;

        // Burn $KIRHA de l'acheteur
        kirhaToken.burn(msg.sender, totalCost);

        // Mint $KIRHA vers le vendeur (moins taxe)
        kirhaToken.mint(l.seller, sellerAmount);

        // Mint taxe vers la trésorerie
        if (taxAmount > 0) {
            kirhaToken.mint(treasury, taxAmount);
        }

        // Transfert ERC-1155 vers l'acheteur
        l.quantity -= quantity;
        if (l.quantity == 0) {
            l.active = false;
        }
        resources.safeTransferFrom(address(this), msg.sender, l.resourceId, quantity, "");

        emit ResourceSold(listingId, msg.sender, quantity, totalCost, sellerAmount);
    }

    // --------------------------------------------------------
    // Annulation
    // --------------------------------------------------------

    /**
     * @notice Annule un listing et récupère les ressources non vendues.
     */
    function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage l = listings[listingId];
        require(l.active,             "KirhaMarket: listing not active");
        require(msg.sender == l.seller,"KirhaMarket: not the seller");

        l.active = false;
        uint256 remaining = l.quantity;
        l.quantity = 0;

        resources.safeTransferFrom(address(this), msg.sender, l.resourceId, remaining, "");
        emit ListingCancelled(listingId, msg.sender);
    }

    // --------------------------------------------------------
    // Lecture
    // --------------------------------------------------------

    function getListing(uint256 listingId) external view returns (Listing memory) {
        return listings[listingId];
    }

    /** Renvoie la liste des listings actifs (max 100) */
    function getActiveListings(uint256 offset, uint256 limit)
        external view returns (Listing[] memory result, uint256[] memory ids)
    {
        uint256 total = nextListingId;
        uint256 count = 0;
        // Première passe : compter les actifs
        for (uint256 i = offset; i < total && count < limit; i++) {
            if (listings[i].active) count++;
        }
        result = new Listing[](count);
        ids    = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = offset; i < total && idx < count; i++) {
            if (listings[i].active) {
                result[idx] = listings[i];
                ids[idx]    = i;
                idx++;
            }
        }
    }

    // --------------------------------------------------------
    // Mise en vente groupée
    // --------------------------------------------------------

    /**
     * @notice Liste plusieurs ressources en une seule transaction.
     * @param resourceIds  Tableau des IDs ERC-1155
     * @param quantities   Tableau des quantités
     * @param prices       Tableau des prix unitaires en $KIRHA wei
     */
    function batchListResources(
        uint256[] calldata resourceIds,
        uint256[] calldata quantities,
        uint256[] calldata prices
    ) external nonReentrant {
        require(resourceIds.length > 0, "KirhaMarket: empty batch");
        require(resourceIds.length == quantities.length, "KirhaMarket: length mismatch");
        require(resourceIds.length == prices.length,     "KirhaMarket: length mismatch");

        for (uint256 i = 0; i < resourceIds.length; i++) {
            require(quantities[i] > 0, "KirhaMarket: quantity must be > 0");
            require(prices[i] > 0,     "KirhaMarket: price must be > 0");

            resources.safeTransferFrom(msg.sender, address(this), resourceIds[i], quantities[i], "");

            uint256 listingId = nextListingId++;
            listings[listingId] = Listing({
                seller:       msg.sender,
                resourceId:   resourceIds[i],
                quantity:     quantities[i],
                pricePerUnit: prices[i],
                active:       true
            });

            emit ResourceListed(listingId, msg.sender, resourceIds[i], quantities[i], prices[i]);
        }
    }

    // --------------------------------------------------------
    // ERC-1155 receiver
    // --------------------------------------------------------

    function onERC1155Received(address, address, uint256, uint256, bytes calldata)
        external pure returns (bytes4)
    {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata)
        external pure returns (bytes4)
    {
        return this.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x4e2312e0; // IERC1155Receiver
    }
}
