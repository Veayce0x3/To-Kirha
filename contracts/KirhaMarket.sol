// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./KirhaToken.sol";
import "./KirhaCity.sol";
import "./KirhaGame.sol";

/**
 * @title KirhaMarket
 * @notice HDV on-chain de To-Kirha — v2 City NFT.
 *
 * Les ressources et $KIRHA sont des balances internes de la ville (cityId),
 * stockées dans KirhaGame. Aucun ERC-1155 ne transite.
 *
 * Flux :
 *   1. Vendeur appelle listResource(cityId, ...) → ressources prélevées de sa ville
 *   2. Acheteur appelle buyResource(listingId, buyerCityId, qty) → $KIRHA prélevés de sa ville, ressources ajoutées
 *   3. Taxe 50% (25% si vendeur VIP) : mintée en ERC-20 vers la trésorerie, reste ajouté en cityKirha du vendeur
 *   4. Vendeur peut cancelListing → ressources restituées dans sa ville
 */
contract KirhaMarket is Ownable, ReentrancyGuard {

    KirhaToken public immutable kirhaToken;
    KirhaCity  public immutable cityNft;
    KirhaGame  public immutable game;

    address public treasury;
    uint256 public constant TAX_BPS = 5000; // 50%

    struct Listing {
        uint256 sellerCityId;
        uint256 resourceId;
        uint256 quantity;       // quantité restante (scaled ×1e4)
        uint256 pricePerUnit;   // prix en $KIRHA wei pour 1 unité (non scalée)
        bool    active;
    }

    uint256 public nextListingId;
    mapping(uint256 => Listing) public listings;

    event ResourceListed(
        uint256 indexed listingId,
        uint256 indexed sellerCityId,
        uint256 resourceId,
        uint256 quantity,
        uint256 pricePerUnit
    );
    event ResourceSold(
        uint256 indexed listingId,
        uint256 indexed buyerCityId,
        uint256 quantity,
        uint256 totalPaid,
        uint256 sellerReceives
    );
    event ListingCancelled(uint256 indexed listingId, uint256 indexed sellerCityId);
    event TreasuryUpdated(address indexed newTreasury);

    constructor(
        address initialOwner,
        address _kirhaToken,
        address _cityNft,
        address _game,
        address _treasury
    ) Ownable(initialOwner) {
        kirhaToken = KirhaToken(_kirhaToken);
        cityNft    = KirhaCity(_cityNft);
        game       = KirhaGame(_game);
        treasury   = _treasury;
    }

    modifier onlyCityOwner(uint256 cityId) {
        require(cityNft.ownerOf(cityId) == msg.sender, "KirhaMarket: not city owner");
        _;
    }

    /** Accepte le propriétaire de la ville OU le relayer actif pour cette ville */
    modifier onlyCityOwnerOrRelayer(uint256 cityId) {
        if (msg.sender != cityNft.ownerOf(cityId)) {
            require(game.isRelayerFor(cityId, msg.sender), "KirhaMarket: not authorized");
        }
        _;
    }

    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    // --------------------------------------------------------
    // Mise en vente
    // --------------------------------------------------------

    /**
     * @param cityId       Ville du vendeur
     * @param resourceId   ID ressource (1-50)
     * @param quantity     Quantité entière à vendre (la conversion ×1e4 est faite ici)
     * @param pricePerUnit Prix unitaire en $KIRHA wei (18 décimales)
     */
    function listResource(
        uint256 cityId,
        uint256 resourceId,
        uint256 quantity,
        uint256 pricePerUnit
    ) external nonReentrant onlyCityOwnerOrRelayer(cityId) returns (uint256 listingId) {
        require(quantity > 0,     "KirhaMarket: quantity must be > 0");
        require(pricePerUnit > 0, "KirhaMarket: price must be > 0");

        uint256 scaledQty = quantity * 1e4;
        game.operatorDeductResource(cityId, resourceId, scaledQty);

        listingId = nextListingId++;
        listings[listingId] = Listing({
            sellerCityId: cityId,
            resourceId:   resourceId,
            quantity:     scaledQty,
            pricePerUnit: pricePerUnit,
            active:       true
        });

        emit ResourceListed(listingId, cityId, resourceId, quantity, pricePerUnit);
    }

    /**
     * @notice Mise en vente groupée (1 signature).
     */
    function batchListResources(
        uint256          cityId,
        uint256[] calldata resourceIds,
        uint256[] calldata quantities,
        uint256[] calldata prices
    ) external nonReentrant onlyCityOwnerOrRelayer(cityId) {
        require(resourceIds.length > 0,                    "KirhaMarket: empty batch");
        require(resourceIds.length == quantities.length,   "KirhaMarket: length mismatch");
        require(resourceIds.length == prices.length,       "KirhaMarket: length mismatch");

        for (uint256 i = 0; i < resourceIds.length; i++) {
            require(quantities[i] > 0, "KirhaMarket: quantity must be > 0");
            require(prices[i] > 0,     "KirhaMarket: price must be > 0");

            uint256 scaledQty = quantities[i] * 1e4;
            game.operatorDeductResource(cityId, resourceIds[i], scaledQty);

            uint256 listingId = nextListingId++;
            listings[listingId] = Listing({
                sellerCityId: cityId,
                resourceId:   resourceIds[i],
                quantity:     scaledQty,
                pricePerUnit: prices[i],
                active:       true
            });

            emit ResourceListed(listingId, cityId, resourceIds[i], quantities[i], prices[i]);
        }
    }

    // --------------------------------------------------------
    // Achat
    // --------------------------------------------------------

    function _executeBuy(uint256 listingId, uint256 buyerCityId, uint256 quantity) internal {
        Listing storage l = listings[listingId];
        require(l.active,                      "KirhaMarket: listing not active");
        require(quantity > 0,                  "KirhaMarket: quantity must be > 0");
        require(buyerCityId != l.sellerCityId, "KirhaMarket: cannot buy own listing");

        uint256 scaledQty = quantity * 1e4;
        require(scaledQty <= l.quantity, "KirhaMarket: not enough stock");

        uint256 totalCost    = quantity * l.pricePerUnit;
        uint256 effectiveTax = game.isVip(l.sellerCityId) ? TAX_BPS / 2 : TAX_BPS;
        uint256 taxAmount    = (totalCost * effectiveTax) / 10000;
        uint256 sellerAmount = totalCost - taxAmount;

        // Déduire $KIRHA de la ville acheteur
        game.operatorDeductKirha(buyerCityId, totalCost);

        // Créditer vendeur (in-game cityKirha)
        game.operatorAddKirha(l.sellerCityId, sellerAmount);

        // Taxe → mint ERC-20 vers trésorerie
        if (taxAmount > 0 && treasury != address(0)) {
            kirhaToken.mint(treasury, taxAmount);
        }

        // Ressources → ville acheteur
        l.quantity -= scaledQty;
        if (l.quantity == 0) l.active = false;
        game.operatorRestoreResource(buyerCityId, l.resourceId, scaledQty);

        emit ResourceSold(listingId, buyerCityId, quantity, totalCost, sellerAmount);
    }

    function buyResource(
        uint256 listingId,
        uint256 buyerCityId,
        uint256 quantity
    ) external nonReentrant onlyCityOwnerOrRelayer(buyerCityId) {
        _executeBuy(listingId, buyerCityId, quantity);
    }

    function batchBuyResources(
        uint256          buyerCityId,
        uint256[] calldata listingIds,
        uint256[] calldata quantities
    ) external nonReentrant onlyCityOwnerOrRelayer(buyerCityId) {
        require(listingIds.length > 0,                  "KirhaMarket: empty batch");
        require(listingIds.length == quantities.length, "KirhaMarket: length mismatch");
        for (uint256 i = 0; i < listingIds.length; i++) {
            _executeBuy(listingIds[i], buyerCityId, quantities[i]);
        }
    }

    // --------------------------------------------------------
    // Annulation
    // --------------------------------------------------------

    function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage l = listings[listingId];
        require(l.active, "KirhaMarket: not active");
        address seller = cityNft.ownerOf(l.sellerCityId);
        require(
            msg.sender == seller || game.isRelayerFor(l.sellerCityId, msg.sender),
            "KirhaMarket: not seller"
        );

        l.active = false;
        uint256 remaining = l.quantity;
        l.quantity = 0;

        game.operatorRestoreResource(l.sellerCityId, l.resourceId, remaining);
        emit ListingCancelled(listingId, l.sellerCityId);
    }

    // --------------------------------------------------------
    // Lecture
    // --------------------------------------------------------

    function getListing(uint256 listingId) external view returns (Listing memory) {
        return listings[listingId];
    }

    /** Renvoie les listings actifs (max 100). */
    function getActiveListings(uint256 offset, uint256 limit)
        external view returns (Listing[] memory result, uint256[] memory ids)
    {
        uint256 total = nextListingId;
        uint256 count = 0;
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
}
