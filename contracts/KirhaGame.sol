// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "./KirhaResources.sol";
import "./KirhaToken.sol";
import "./KirhaCity.sol";

/**
 * @title KirhaGame
 * @notice Contrat principal de To-Kirha — v2 City NFT.
 *
 * Toutes les données de jeu sont indexées par cityId (tokenId du NFT KirhaCity).
 * Transférer le NFT KirhaCity transfère la propriété de toutes les données.
 *
 * Métiers : bucheron=0  paysan=1  pecheur=2  mineur=3  alchimiste=4
 *
 * NOTE TESTNET : batchSave accepte kirhaGained sans vérification de signature.
 *   Réactiver ECDSA avant mainnet.
 */
contract KirhaGame is Ownable, ReentrancyGuard {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    /** Aligné sur KirhaResources.MAX_RESOURCE_ID — ressources + ferme / artisanat */
    uint256 public constant MAX_CHAIN_RESOURCE_ID = 69;

    KirhaResources public immutable resources;
    KirhaToken     public immutable kirhaToken;
    KirhaCity      public immutable cityNft;

    // ── Pseudos ────────────────────────────────────────────────
    mapping(string  => address) private _pseudoToAddress;
    mapping(address => string)  public  playerPseudo;
    /** Pseudo lié à la ville (suit le NFT lors des transferts) */
    mapping(uint256 => string)  public  cityPseudo;

    // ── Compteur séquentiel ────────────────────────────────────
    uint256 public playerCount;

    // ── État du jeu par cityId ─────────────────────────────────
    /** Ressources : cityId → resourceId (1-50) → quantité (scaled ×1e4 pour fractions) */
    mapping(uint256 => mapping(uint256 => uint256)) public cityResources;

    /** $KIRHA in-game : cityId → montant en wei (18 décimales) */
    mapping(uint256 => uint256) public cityKirha;

    /** Niveaux métiers : cityId → metierId (0-4) → niveau (1-100) */
    mapping(uint256 => mapping(uint8 => uint32)) public cityMetierLevel;

    /** XP métiers : cityId → metierId (0-4) → xp */
    mapping(uint256 => mapping(uint8 => uint32)) public cityMetierXp;

    /** XP total métiers : cityId → metierId (0-4) → xp_total */
    mapping(uint256 => mapping(uint8 => uint32)) public cityMetierXpTotal;

    // ── Opérateurs autorisés (ex : KirhaMarket) ───────────────
    mapping(address => bool) public operators;

    // ── Bans ──────────────────────────────────────────────────
    mapping(uint256 => bool) public bannedCities;

    // ── Session relayer ───────────────────────────────────────
    struct RelayerSession { address relayer; uint64 expiry; }
    mapping(uint256 => RelayerSession) public relayerSession;
    address public trustedRelayer;
    bool public relayerGloballyEnabled = true;
    uint64 public constant MAX_RELAYER_SESSION = 2 days;
    mapping(uint256 => mapping(uint256 => bool)) public usedSaveNonces;

    /** Progression client (slots, temple, craft, etc.) — source hors mappings économiques */
    mapping(uint256 => bytes) public playerProgress;

    // ── VIP ───────────────────────────────────────────────────
    mapping(uint256 => uint64)  public vipExpiry;
    mapping(uint256 => uint256) public cityPepites;

    // ── Pack prices in $KIRHA wei ──────────────────────────────
    uint256 public constant PACK_SMALL_PRICE   = 5 ether;   // 50 pépites
    uint256 public constant PACK_MEDIUM_PRICE  = 13 ether;  // 150 pépites (+10%)
    uint256 public constant PACK_LARGE_PRICE   = 32 ether;  // 400 pépites (+25%)
    uint256 public constant PACK_PREMIUM_PRICE = 65 ether;  // 1000 pépites (+50%)

    // ── VIP prices in pépites ──────────────────────────────────
    uint256 public constant VIP_7D_PEPITES  = 100;
    uint256 public constant VIP_30D_PEPITES = 300;
    uint256 public constant VIP_90D_PEPITES = 700;

    // ── Events ────────────────────────────────────────────────
    event PseudoRegistered(address indexed player, string pseudo, uint256 indexed cityId);
    event DataSaved(address indexed player, uint256 indexed cityId);
    event KirhaWithdrawn(address indexed player, uint256 indexed cityId, uint256 amount);
    event KirhaDeposited(address indexed player, uint256 indexed cityId, uint256 amount);
    event ResourcesWithdrawn(address indexed player, uint256 indexed cityId);
    event ResourcesDeposited(address indexed player, uint256 indexed cityId);
    event CityBanned(uint256 indexed cityId, bool banned);
    event RelayerAuthorized(uint256 indexed cityId, address relayer, uint64 expiry);
    event RelayerSessionRevoked(uint256 indexed cityId);
    event RelayerGlobalStatus(bool enabled);
    event PepitesBought(uint256 indexed cityId, uint8 packType, uint256 pepites);
    event VipPurchased(uint256 indexed cityId, uint64 expiry, uint8 durationType);
    event CityDeleted(uint256 indexed cityId);
    event PlayerProgressSaved(uint256 indexed cityId);

    // ── Modifiers ─────────────────────────────────────────────

    modifier onlyCityOwner(uint256 cityId) {
        require(cityNft.ownerOf(cityId) == msg.sender, "KirhaGame: not city owner");
        _;
    }

    modifier onlyOperator() {
        require(operators[msg.sender], "KirhaGame: not operator");
        _;
    }

    modifier notBanned(uint256 cityId) {
        require(!bannedCities[cityId], "KirhaGame: city is banned");
        _;
    }

    modifier onlyCityOwnerOrRelayer(uint256 cityId) {
        address owner = cityNft.ownerOf(cityId);
        if (msg.sender != owner) {
            require(relayerGloballyEnabled, "KirhaGame: relayer disabled");
            RelayerSession memory s = relayerSession[cityId];
            require(s.relayer == msg.sender && uint64(block.timestamp) < s.expiry, "KirhaGame: not authorized");
        }
        _;
    }

    constructor(
        address initialOwner,
        address _resources,
        address _kirhaToken,
        address _cityNft
    ) Ownable(initialOwner) {
        resources  = KirhaResources(_resources);
        kirhaToken = KirhaToken(_kirhaToken);
        cityNft    = KirhaCity(_cityNft);
    }

    // --------------------------------------------------------
    // Administration
    // --------------------------------------------------------

    function setOperator(address op, bool approved) external onlyOwner {
        operators[op] = approved;
    }

    function setBan(uint256 cityId, bool banned) external onlyOwner {
        bannedCities[cityId] = banned;
        emit CityBanned(cityId, banned);
    }

    function setTrustedRelayer(address relayer) external onlyOwner {
        trustedRelayer = relayer;
    }

    function setRelayerGloballyEnabled(bool enabled) external onlyOwner {
        relayerGloballyEnabled = enabled;
        emit RelayerGlobalStatus(enabled);
    }

    function adminDeleteCity(uint256 cityId) external onlyOwner {
        string memory pseudo = cityPseudo[cityId];
        if (bytes(pseudo).length > 0) {
            address currentOwner = cityNft.ownerOf(cityId);
            delete _pseudoToAddress[pseudo];
            delete playerPseudo[currentOwner];
            delete cityPseudo[cityId];
        }
        cityKirha[cityId]    = 0;
        cityPepites[cityId]  = 0;
        vipExpiry[cityId]    = 0;
        bannedCities[cityId] = true;
        cityNft.burnCity(cityId);
        emit CityDeleted(cityId);
    }

    /** @notice Remet à zéro ressources + $KIRHA + pépites d'une ville (garde NFT, métiers, pseudo). */
    function adminResetCity(uint256 cityId) external onlyOwner {
        for (uint256 i = 1; i <= MAX_CHAIN_RESOURCE_ID; i++) {
            cityResources[cityId][i] = 0;
        }
        cityKirha[cityId]   = 0;
        cityPepites[cityId] = 0;
    }

    /** @notice Donne du $KIRHA in-game à une ville. */
    function adminGiveKirha(uint256 cityId, uint256 amount) external onlyOwner {
        cityKirha[cityId] += amount;
    }

    /** @notice Donne des pépites d'or à une ville. */
    function adminGivePepites(uint256 cityId, uint256 amount) external onlyOwner {
        cityPepites[cityId] += amount;
    }

    /** @notice Donne le VIP à une ville pour un nombre de jours supplémentaires. */
    function adminGiveVip(uint256 cityId, uint64 daysCount) external onlyOwner {
        uint64 base = vipExpiry[cityId] > uint64(block.timestamp) ? vipExpiry[cityId] : uint64(block.timestamp);
        vipExpiry[cityId] = base + daysCount * 1 days;
    }

    /** @notice Donne une ressource à une ville (amount = quantité entière, scalée ×1e4 en interne). */
    function adminGiveResource(uint256 cityId, uint256 resourceId, uint256 amount) external onlyOwner {
        require(resourceId >= 1 && resourceId <= MAX_CHAIN_RESOURCE_ID, "KirhaGame: invalid resource id");
        cityResources[cityId][resourceId] += amount * 1e4;
    }

    /** @notice Modifie le niveau et l'XP d'un métier pour une ville. */
    function adminSetMetierXp(
        uint256 cityId,
        uint8   metierId,
        uint32  level,
        uint32  xp,
        uint32  xpTotal
    ) external onlyOwner {
        require(metierId < 5, "KirhaGame: invalid metier id");
        cityMetierLevel[cityId][metierId]   = level;
        cityMetierXp[cityId][metierId]      = xp;
        cityMetierXpTotal[cityId][metierId] = xpTotal;
    }

    // --------------------------------------------------------
    // Enregistrement — crée la ville NFT
    // --------------------------------------------------------

    /**
     * @notice Enregistre un pseudo et mint le NFT ville.
     * @param name  3-16 caractères, alphanumérique + underscore
     */
    function registerPseudo(string calldata name) external {
        uint256 len = bytes(name).length;
        require(len >= 3 && len <= 16,                       "KirhaGame: invalid name length");
        require(bytes(playerPseudo[msg.sender]).length == 0, "KirhaGame: already registered");
        require(_pseudoToAddress[name] == address(0),        "KirhaGame: pseudo already taken");

        // Vérifier le ban si une ville existe déjà pour ce wallet
        uint256 existingCityId = cityNft.ownerToCityId(msg.sender);
        if (existingCityId > 0) {
            require(!bannedCities[existingCityId], "KirhaGame: banned");
        }

        _pseudoToAddress[name]   = msg.sender;
        playerPseudo[msg.sender] = name;
        playerCount++;
        uint256 cityId = playerCount;
        cityPseudo[cityId]       = name;

        // Initialiser les niveaux à 1 pour les 5 métiers
        for (uint8 m = 0; m < 5; m++) {
            cityMetierLevel[cityId][m] = 1;
        }

        cityNft.mintCity(msg.sender, cityId, name);
        emit PseudoRegistered(msg.sender, name, cityId);
    }

    /** @notice Retourne true si le pseudo est disponible. */
    function isPseudoAvailable(string calldata name) external view returns (bool) {
        return _pseudoToAddress[name] == address(0);
    }

    /** @notice cityId de l'adresse (basé sur ownerToCityId du NFT — reflète les transferts) */
    function playerCityId(address player) external view returns (uint256) {
        return cityNft.ownerToCityId(player);
    }

    // --------------------------------------------------------
    // Session relayer
    // --------------------------------------------------------

    function authorizeRelayer(uint256 cityId, uint64 durationSeconds) external onlyCityOwner(cityId) {
        require(trustedRelayer != address(0), "KirhaGame: no trusted relayer set");
        require(relayerGloballyEnabled, "KirhaGame: relayer disabled");
        require(durationSeconds > 0 && durationSeconds <= MAX_RELAYER_SESSION, "KirhaGame: invalid session duration");
        uint64 expiry = uint64(block.timestamp) + durationSeconds;
        relayerSession[cityId] = RelayerSession({ relayer: trustedRelayer, expiry: expiry });
        emit RelayerAuthorized(cityId, trustedRelayer, expiry);
    }

    function revokeRelayerSession(uint256 cityId) external onlyCityOwner(cityId) {
        delete relayerSession[cityId];
        emit RelayerSessionRevoked(cityId);
    }

    function isRelayerActive(uint256 cityId) external view returns (bool) {
        RelayerSession memory s = relayerSession[cityId];
        return s.relayer != address(0) && uint64(block.timestamp) < s.expiry;
    }

    /** Retourne true si addr est le relayer actif pour cette ville (utilisé par KirhaMarket) */
    function isRelayerFor(uint256 cityId, address addr) external view returns (bool) {
        RelayerSession memory s = relayerSession[cityId];
        return s.relayer == addr && uint64(block.timestamp) < s.expiry;
    }

    // --------------------------------------------------------
    // Sauvegarde on-chain (TESTNET — sans vérification signature)
    // --------------------------------------------------------

    /**
     * @notice Sauvegarde groupée : ressources récoltées + niveaux métiers + $KIRHA gagné.
     *
     * @param cityId         Ville à sauvegarder (appelant doit en être le propriétaire ou relayer actif)
     * @param resourceIds    IDs des ressources à ajouter (1-50)
     * @param resourceAmts   Quantités à ajouter (×1e4, ex: 1.5 → 15000)
     * @param metierIds      IDs des métiers à mettre à jour (0-4)
     * @param metierLevels   Niveaux courants (1-100)
     * @param metierXps      XP courant dans le niveau
     * @param metierXpTotals XP total accumulé
     * @param kirhaGained    $KIRHA gagné depuis la dernière sauvegarde (en wei)
     *
     * NOTE TESTNET : kirhaGained n'est pas validé on-chain.
     */
    function _applyBatchSave(
        uint256          cityId,
        uint256[] calldata resourceIds,
        uint256[] calldata resourceAmts,
        uint8[]   calldata metierIds,
        uint32[]  calldata metierLevels,
        uint32[]  calldata metierXps,
        uint32[]  calldata metierXpTotals,
        uint256            kirhaGained
    ) internal {
        require(resourceIds.length == resourceAmts.length, "KirhaGame: resources length mismatch");
        require(
            metierIds.length == metierLevels.length &&
            metierIds.length == metierXps.length &&
            metierIds.length == metierXpTotals.length,
            "KirhaGame: metiers length mismatch"
        );

        for (uint256 i = 0; i < resourceIds.length; i++) {
            require(resourceIds[i] >= 1 && resourceIds[i] <= MAX_CHAIN_RESOURCE_ID, "KirhaGame: invalid resource id");
            cityResources[cityId][resourceIds[i]] += resourceAmts[i];
        }

        for (uint256 i = 0; i < metierIds.length; i++) {
            require(metierIds[i] < 5, "KirhaGame: invalid metier id");
            cityMetierLevel[cityId][metierIds[i]]   = metierLevels[i];
            cityMetierXp[cityId][metierIds[i]]      = metierXps[i];
            cityMetierXpTotal[cityId][metierIds[i]] = metierXpTotals[i];
        }

        if (kirhaGained > 0) {
            cityKirha[cityId] += kirhaGained;
        }
    }

    function batchSave(
        uint256          cityId,
        uint256[] calldata resourceIds,
        uint256[] calldata resourceAmts,
        uint8[]   calldata metierIds,
        uint32[]  calldata metierLevels,
        uint32[]  calldata metierXps,
        uint32[]  calldata metierXpTotals,
        uint256            kirhaGained
    ) external nonReentrant onlyCityOwner(cityId) notBanned(cityId) {
        _applyBatchSave(cityId, resourceIds, resourceAmts, metierIds, metierLevels, metierXps, metierXpTotals, kirhaGained);
        emit DataSaved(msg.sender, cityId);
    }

    /**
     * @notice Sauvegarde opaque de la progression UI (slots, temple, craft…). Appelée via relayer signé.
     * @dev Limite taille pour éviter dos gas ; client split si besoin en v2.
     */
    function setPlayerProgress(uint256 cityId, bytes calldata data)
        external
        nonReentrant
        onlyCityOwnerOrRelayer(cityId)
        notBanned(cityId)
    {
        require(data.length <= 32000, "KirhaGame: progress too large");
        playerProgress[cityId] = data;
        emit PlayerProgressSaved(cityId);
    }

    function batchSaveSigned(
        uint256          cityId,
        uint256[] calldata resourceIds,
        uint256[] calldata resourceAmts,
        uint8[]   calldata metierIds,
        uint32[]  calldata metierLevels,
        uint32[]  calldata metierXps,
        uint32[]  calldata metierXpTotals,
        uint256            kirhaGained,
        uint64             deadline,
        uint256            nonce,
        bytes calldata     signature
    ) external nonReentrant onlyCityOwnerOrRelayer(cityId) notBanned(cityId) {
        require(uint64(block.timestamp) <= deadline, "KirhaGame: signature expired");
        require(!usedSaveNonces[cityId][nonce], "KirhaGame: nonce already used");

        address owner = cityNft.ownerOf(cityId);
        bytes32 payloadHash = keccak256(
            abi.encodePacked(
                address(this),
                block.chainid,
                cityId,
                keccak256(abi.encodePacked(resourceIds)),
                keccak256(abi.encodePacked(resourceAmts)),
                keccak256(abi.encodePacked(metierIds)),
                keccak256(abi.encodePacked(metierLevels)),
                keccak256(abi.encodePacked(metierXps)),
                keccak256(abi.encodePacked(metierXpTotals)),
                kirhaGained,
                deadline,
                nonce
            )
        );
        address recovered = payloadHash.toEthSignedMessageHash().recover(signature);
        require(recovered == owner, "KirhaGame: invalid signature");

        usedSaveNonces[cityId][nonce] = true;
        _applyBatchSave(cityId, resourceIds, resourceAmts, metierIds, metierLevels, metierXps, metierXpTotals, kirhaGained);
        emit DataSaved(recovered, cityId);
    }

    // --------------------------------------------------------
    // $KIRHA — Retrait (cityKirha → ERC-20 dans le wallet)
    // --------------------------------------------------------

    function withdrawKirha(uint256 cityId, uint256 amount) external nonReentrant onlyCityOwner(cityId) notBanned(cityId) {
        require(amount > 0,                    "KirhaGame: amount must be > 0");
        require(cityKirha[cityId] >= amount,   "KirhaGame: insufficient city kirha");
        cityKirha[cityId] -= amount;
        kirhaToken.mint(msg.sender, amount);
        emit KirhaWithdrawn(msg.sender, cityId, amount);
    }

    // --------------------------------------------------------
    // $KIRHA — Dépôt (ERC-20 wallet → cityKirha)
    // --------------------------------------------------------

    /**
     * @notice Dépose des $KIRHA du wallet dans la ville (brûle les tokens ERC-20).
     *         Le contrat KirhaGame doit être minter sur KirhaToken pour pouvoir brûler.
     */
    function depositKirha(uint256 cityId, uint256 amount) external nonReentrant onlyCityOwner(cityId) notBanned(cityId) {
        require(amount > 0, "KirhaGame: amount must be > 0");
        kirhaToken.burn(msg.sender, amount);
        cityKirha[cityId] += amount;
        emit KirhaDeposited(msg.sender, cityId, amount);
    }

    // --------------------------------------------------------
    // Ressources — Retrait vers wallet (cityResources → ERC-1155)
    // --------------------------------------------------------

    /**
     * @notice Retire des ressources de la ville vers le wallet (mint ERC-1155).
     * @param cityId  Ville source
     * @param ids     IDs des ressources (1-50)
     * @param amounts Quantités (entières, non ×1e4)
     */
    function withdrawResources(
        uint256          cityId,
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) external nonReentrant onlyCityOwner(cityId) {
        require(ids.length > 0,              "KirhaGame: empty");
        require(ids.length == amounts.length,"KirhaGame: length mismatch");
        for (uint256 i = 0; i < ids.length; i++) {
            uint256 scaled = amounts[i] * 1e4;
            require(cityResources[cityId][ids[i]] >= scaled, "KirhaGame: insufficient resources");
            cityResources[cityId][ids[i]] -= scaled;
        }
        resources.mintBatch(msg.sender, ids, amounts);
        emit ResourcesWithdrawn(msg.sender, cityId);
    }

    // --------------------------------------------------------
    // Ressources — Dépôt depuis wallet (ERC-1155 → cityResources)
    // --------------------------------------------------------

    /**
     * @notice Dépose des ERC-1155 du wallet dans la ville (brûle les tokens).
     */
    function depositResources(
        uint256          cityId,
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) external nonReentrant onlyCityOwner(cityId) {
        require(ids.length > 0,              "KirhaGame: empty");
        require(ids.length == amounts.length,"KirhaGame: length mismatch");
        resources.burnBatch(msg.sender, ids, amounts);
        for (uint256 i = 0; i < ids.length; i++) {
            cityResources[cityId][ids[i]] += amounts[i] * 1e4;
        }
        emit ResourcesDeposited(msg.sender, cityId);
    }

    // --------------------------------------------------------
    // Pépites d'or — Achat avec $KIRHA in-game
    // --------------------------------------------------------

    /**
     * @notice Achète un pack de pépites d'or en dépensant du $KIRHA in-game.
     * @param cityId   Ville de l'acheteur
     * @param packType 0=Small (50 pép, 5 KIRHA) | 1=Medium (165 pép, 13 KIRHA) |
     *                 2=Large (500 pép, 32 KIRHA) | 3=Premium (1500 pép, 65 KIRHA)
     */
    function buyPepites(uint256 cityId, uint8 packType) external nonReentrant onlyCityOwner(cityId) notBanned(cityId) {
        uint256 price;
        uint256 pepites;
        if (packType == 0)      { price = PACK_SMALL_PRICE;   pepites = 50;   }
        else if (packType == 1) { price = PACK_MEDIUM_PRICE;  pepites = 150;  }
        else if (packType == 2) { price = PACK_LARGE_PRICE;   pepites = 400;  }
        else if (packType == 3) { price = PACK_PREMIUM_PRICE; pepites = 1000; }
        else revert("KirhaGame: invalid pack type");
        require(cityKirha[cityId] >= price, "KirhaGame: insufficient kirha");
        cityKirha[cityId] -= price;
        cityPepites[cityId] += pepites;
        emit PepitesBought(cityId, packType, pepites);
    }

    // --------------------------------------------------------
    // VIP — Achat avec pépites d'or
    // --------------------------------------------------------

    /**
     * @notice Achète un abonnement VIP en dépensant des pépites d'or.
     * @param cityId       Ville de l'acheteur
     * @param durationType 0=7 jours (100 pép) | 1=30 jours (300 pép) | 2=90 jours (700 pép)
     */
    function buyVip(uint256 cityId, uint8 durationType) external nonReentrant onlyCityOwner(cityId) notBanned(cityId) {
        uint256 cost;
        uint64 duration;
        if (durationType == 0)      { cost = VIP_7D_PEPITES;  duration = 7 days;  }
        else if (durationType == 1) { cost = VIP_30D_PEPITES; duration = 30 days; }
        else if (durationType == 2) { cost = VIP_90D_PEPITES; duration = 90 days; }
        else revert("KirhaGame: invalid duration");
        require(cityPepites[cityId] >= cost, "KirhaGame: insufficient pepites");
        cityPepites[cityId] -= cost;
        uint64 base = vipExpiry[cityId] > uint64(block.timestamp) ? vipExpiry[cityId] : uint64(block.timestamp);
        vipExpiry[cityId] = base + duration;
        emit VipPurchased(cityId, vipExpiry[cityId], durationType);
    }

    /** @notice Retourne true si la ville est VIP actif. */
    function isVip(uint256 cityId) public view returns (bool) {
        return vipExpiry[cityId] > uint64(block.timestamp);
    }

    // --------------------------------------------------------
    // Fonctions opérateur — appelées par KirhaMarket
    // --------------------------------------------------------

    function operatorDeductResource(uint256 cityId, uint256 resourceId, uint256 amountScaled)
        external onlyOperator
    {
        require(cityResources[cityId][resourceId] >= amountScaled, "KirhaGame: insufficient resources");
        cityResources[cityId][resourceId] -= amountScaled;
    }

    function operatorRestoreResource(uint256 cityId, uint256 resourceId, uint256 amountScaled)
        external onlyOperator
    {
        cityResources[cityId][resourceId] += amountScaled;
    }

    function operatorDeductKirha(uint256 cityId, uint256 amount)
        external onlyOperator
    {
        require(cityKirha[cityId] >= amount, "KirhaGame: insufficient kirha");
        cityKirha[cityId] -= amount;
    }

    function operatorAddKirha(uint256 cityId, uint256 amount)
        external onlyOperator
    {
        cityKirha[cityId] += amount;
    }

    // --------------------------------------------------------
    // Vues
    // --------------------------------------------------------

    /** Retourne les balances de ressources pour une liste d'IDs (scaled ×1e4). */
    function getCityResources(uint256 cityId, uint256[] calldata ids)
        external view returns (uint256[] memory balances)
    {
        balances = new uint256[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            balances[i] = cityResources[cityId][ids[i]];
        }
    }

    struct MetierState {
        uint8  metierId;
        uint32 level;
        uint32 xp;
        uint32 xpTotal;
    }

    /** Retourne les pseudos pour une liste de cityIds. */
    function getCityPseudos(uint256[] calldata cityIds)
        external view returns (string[] memory pseudos)
    {
        pseudos = new string[](cityIds.length);
        for (uint256 i = 0; i < cityIds.length; i++) {
            pseudos[i] = cityPseudo[cityIds[i]];
        }
    }

    /** Retourne l'état des 5 métiers d'une ville. */
    function getCityMetiers(uint256 cityId)
        external view returns (MetierState[5] memory state)
    {
        for (uint8 m = 0; m < 5; m++) {
            state[m] = MetierState({
                metierId: m,
                level:    cityMetierLevel[cityId][m],
                xp:       cityMetierXp[cityId][m],
                xpTotal:  cityMetierXpTotal[cityId][m]
            });
        }
    }

    /**
     * @notice Retourne le statut global d'une ville : $KIRHA, pépites, VIP.
     */
    function getCityStatus(uint256 cityId) external view returns (
        uint256 kirha,
        uint256 pepites,
        bool    vip,
        uint64  vipExpiry_
    ) {
        return (cityKirha[cityId], cityPepites[cityId], isVip(cityId), vipExpiry[cityId]);
    }
}
