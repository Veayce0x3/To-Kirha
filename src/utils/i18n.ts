import { useGameStore } from '../store/gameStore';

// ============================================================
// Traductions
// Règles : nom du jeu "To-Kirha", "$KIRHA", "Pépites d'or"
//          restent en français dans les deux langues
// ============================================================

const TRANSLATIONS = {
  fr: {
    // --- Navigation / Global ---
    'nav.home':          'Kirha-City',
    'nav.inventory':     'Inventaire',
    'nav.settings':      'Paramètres',
    'nav.back_home':     '← Accueil',
    'nav.back':          '← Retour',

    // --- ConnectPage ---
    'connect.tagline':            'Récolte. Échange. Prospère.',
    'connect.feature_1':          '5 métiers de récolte',
    'connect.feature_2':          'Ressources NFT ERC-1155',
    'connect.feature_3':          'Token $KIRHA sur Base',
    'connect.feature_4':          'Sauvegarde on-chain',
    'connect.feature_5':          'Web app — aucune appli à installer',
    'connect.create_city':        'Créer une ville',
    'connect.sign_in':            'Se connecter',
    'connect.network':            'Base Sepolia Testnet',
    'connect.choose_pseudo':      'Choisir votre pseudo',
    'connect.pseudo_info':        'Votre pseudo est lié à votre ville NFT. Il ne pourra pas être changé.',
    'connect.pseudo_placeholder': 'Pseudo (3-16 caractères)',
    'connect.confirm':            'Confirmer',
    'connect.back':               '← Retour',
    'connect.pseudo_taken':       'Ce pseudo est déjà pris.',
    'connect.pseudo_invalid':     '3 à 16 caractères, lettres/chiffres/underscore uniquement.',

    // --- HomePage ---
    'home.pepites':          "Pépites d'or",
    'home.card_recolte':     'Récolte',
    'home.card_recolte_desc':'Bois · Céréales · Poissons · Minerais · Herbes',
    'home.card_hdv':         'HDV',
    'home.card_hdv_desc':    'Vendez vos ressources au PNJ',
    'home.card_banque':      'Banque',
    'home.card_banque_desc': 'Retirez vos $KIRHA vers votre wallet',
    'home.card_maison':      'Maison',
    'home.card_maison_desc': 'Inventaire · Stats · Personnage',
    'home.card_craft':       'Craft',
    'home.card_craft_desc':  'Créez des objets avec vos ressources',
    'home.card_ferme':       'Ferme',
    'home.card_ferme_desc':  'Puits · Animaux · Productions',

    // --- RecoltePage ---
    'recolte.title':           '🌿 Récolte',
    'recolte.harvest_points':  'Points de récolte',
    'recolte.unlocked':        'débloqués',
    'recolte.locked':          'Verrouillé',
    'recolte.choose_resource': '＋ Choisir',
    'recolte.tap_to_harvest':  '▶ Récolter',
    'recolte.change':          '✏️ Changer',
    'recolte.select_resource': 'Choisir une ressource',
    'recolte.close':           'Fermer',
    'recolte.unlock_slot':     'Débloquer l\'emplacement',
    'recolte.you_have':        'Vous en avez',
    'recolte.required':        'requis',
    'recolte.unlock_btn':      'Débloquer',
    'recolte.cancel':          'Annuler',
    'recolte.ready':           '✅ Prêt',
    'recolte.level_req':       'Niv.',
    'recolte.level':           'Niv.',
    'recolte.xp':              'XP',
    'recolte.active_indicator':'●',
    'recolte.back':            '← Retour',
    'recolte.back_home':       '← Accueil',

    // --- HdvPage ---
    'hdv.title':          '🏪 HDV',
    'hdv.pnj_name':       'Marchand Kuro',
    'hdv.pnj_subtitle':   'Achète vos ressources à prix fixe — Testnet',
    'hdv.open':           'OUVERT',
    'hdv.select_prompt':  'Sélectionnez des ressources à vendre :',
    'hdv.in_stock':       'en stock',
    'hdv.per_unit':       '$KIRHA/unité',
    'hdv.sell_all':       'Vendre tout',
    'hdv.sold':           'Vendu ✓',
    'hdv.empty':          'Votre inventaire est vide.',
    'hdv.go_harvest':     'Aller récolter →',
    'hdv.coming_soon':    'Vente on-chain bientôt disponible',
    'hdv.back_home':      '← Accueil',

    // --- BanquePage ---
    'banque.title':           '🏦 Banque',
    'banque.wallet_connected':'Wallet connecté',
    'banque.balance_kirha':   'Solde $KIRHA',
    'banque.withdraw_title':  '💸 Retrait $KIRHA',
    'banque.withdraw_avail':  'Solde disponible',
    'banque.withdraw_all':    'Tout retirer',
    'banque.amount_placeholder': 'Montant...',
    'banque.save_title':      '💾 Sauvegarde on-chain',
    'banque.save_pending':    'ressource(s) à sauvegarder',
    'banque.save_none':       'Aucune ressource en attente',
    'banque.save_last':       'Dernière sauvegarde',
    'banque.save_never':      'Jamais',
    'banque.save_btn':        '💾 Sauvegarder',
    'banque.save_signing':    '✍️ Signature…',
    'banque.save_pending_tx': '⏳ Transaction en cours…',
    'banque.save_success':    '✅ Sauvegardé !',
    'banque.vip_title':       'Abonnement VIP',
    'banque.vip_desc':        'Bientôt disponible — Bonus de récolte et slots supplémentaires',
    'banque.coming_soon':     'Bientôt disponible',
    'banque.back_home':       '← Accueil',

    // --- MaisonPage ---
    'maison.title':       '🏠 Maison',
    'maison.tab_res':     '📦 Ressources',
    'maison.tab_metiers': '⚔️ Métiers',
    'maison.tab_perso':   '👗 Personnage',
    'maison.sort_qty':    '# Quantité',
    'maison.sort_cat':    '📂 Catégorie',
    'maison.empty':       'Inventaire vide',
    'maison.go_harvest':  'Aller récolter →',
    'maison.xp_total':    'XP total',
    'maison.perso_title': 'Personnage & Vêtements',
    'maison.perso_desc':  'Bientôt disponible — Équipez votre personnage pour des bonus de récolte',
    'maison.back_home':   '← Accueil',
    'maison.level':       'Niv.',

    // --- CraftPage ---
    'craft.title':   '⚗️ Craft',
    'craft.heading': 'Atelier de Craft',
    'craft.desc':    'Transformez vos ressources en objets puissants.',
    'craft.desc2':   'Bientôt disponible.',
    'craft.wip':     '🚧 En développement',
    'craft.back_home': '← Accueil',

    // --- BottomMenu Inventaire ---
    'inventory.title':       '🎒 Inventaire',
    'inventory.tab_res':     '📦 Ressources',
    'inventory.tab_perso':   '👗 Personnage',
    'inventory.sort_qty':    '# Quantité',
    'inventory.sort_cat':    '📂 Catégorie',
    'inventory.empty':       'Aucune ressource récoltée pour l\'instant.',
    'inventory.perso_title': 'Personnage & Vêtements',
    'inventory.perso_desc':  'Bientôt disponible — Équipez votre personnage',

    // --- SettingsModal ---
    'settings.title':         '⚙️ Paramètres',
    'settings.language':      'Langue',
    'settings.save':          'Sauvegarde on-chain',
    'settings.kirha_price':   'Prix $KIRHA',
    'settings.kirha_approx':  '1 $KIRHA ≈',
    'settings.transfer':      'Transfert $KIRHA',
    'settings.transfer_desc': 'Transfert disponible depuis la Banque →',
    'settings.bank_link':     'Banque',
    'settings.city_id':       'ID Ville (NFT)',
    'settings.city_prefix':   '🏙️ Ville #',
    'settings.account':       'Compte',
    'settings.disconnect':    '🚪 Se déconnecter',
    'settings.save_pending':  'en attente',
    'settings.save_signing':  '✍️ Signature requise...',
    'settings.save_pending_tx': '⏳ Transaction en cours...',
    'settings.save_success':  '✅ Sauvegardé !',
    'settings.save_error':    '❌ Erreur — Réessayer',
    'settings.save_btn':      '💾 Sauvegarder',

    // --- TemplePage ---
    'home.card_temple':      'Temple',
    'home.card_temple_desc': 'Quêtes quotidiennes',
    'temple.title':          'Temple des Offrandes',
    'temple.subtitle':       'Offrandes quotidiennes — réinitialisées à minuit UTC',
    'temple.quest_label':    'Offrir',
    'temple.completed':      'Complété ✓',
    'temple.insufficient':   'Ressources insuffisantes',
    'temple.reset_in':       'Réinitialisation dans',

    // --- Métiers ---
    'metier.bucheron':         'Bûcheron',
    'metier.paysan':           'Paysan',
    'metier.pecheur':          'Pêcheur',
    'metier.mineur':           'Mineur',
    'metier.alchimiste':       'Alchimiste',
    'metier.bucheron_desc':    'Arbres & bois précieux',
    'metier.paysan_desc':      'Céréales & cultures',
    'metier.pecheur_desc':     'Poissons & créatures marines',
    'metier.mineur_desc':      'Minerais & gemmes',
    'metier.alchimiste_desc':  'Herbes & plantes magiques',

    // --- Commun ---
    'common.level':       'Niv.',
    'common.saving':      '⏳ Transaction en cours…',
    'common.signing':     '✍️ Signature…',
    'common.saved':       '✅ Sauvegardé !',
    'common.error_retry': '❌ Erreur — Réessayer',
    'common.save_count':  '💾 Sauvegarder',
    'common.never':       'Jamais',
  },

  en: {
    // --- Navigation / Global ---
    'nav.home':          'Kirha-City',
    'nav.inventory':     'Inventory',
    'nav.settings':      'Settings',
    'nav.back_home':     '← Home',
    'nav.back':          '← Back',

    // --- ConnectPage ---
    'connect.tagline':            'Harvest. Trade. Prosper.',
    'connect.feature_1':          '5 harvesting professions',
    'connect.feature_2':          'NFT resources ERC-1155',
    'connect.feature_3':          '$KIRHA token on Base',
    'connect.feature_4':          'On-chain save',
    'connect.feature_5':          'Web app — no install needed',
    'connect.create_city':        'Create a city',
    'connect.sign_in':            'Sign in',
    'connect.network':            'Base Sepolia Testnet',
    'connect.choose_pseudo':      'Choose your username',
    'connect.pseudo_info':        'Your username is linked to your NFT city. It cannot be changed.',
    'connect.pseudo_placeholder': 'Username (3-16 characters)',
    'connect.confirm':            'Confirm',
    'connect.back':               '← Back',
    'connect.pseudo_taken':       'This username is already taken.',
    'connect.pseudo_invalid':     '3 to 16 characters, letters/digits/underscore only.',

    // --- HomePage ---
    'home.pepites':          "Pépites d'or",
    'home.card_recolte':     'Harvest',
    'home.card_recolte_desc':'Wood · Crops · Fish · Ores · Herbs',
    'home.card_hdv':         'Market',
    'home.card_hdv_desc':    'Sell your resources to the NPC',
    'home.card_banque':      'Bank',
    'home.card_banque_desc': 'Withdraw your $KIRHA to your wallet',
    'home.card_maison':      'Home',
    'home.card_maison_desc': 'Inventory · Stats · Character',
    'home.card_craft':       'Craft',
    'home.card_craft_desc':  'Craft items with your resources',
    'home.card_ferme':       'Farm',
    'home.card_ferme_desc':  'Well · Animals · Production',

    // --- RecoltePage ---
    'recolte.title':           '🌿 Harvest',
    'recolte.harvest_points':  'Harvest slots',
    'recolte.unlocked':        'unlocked',
    'recolte.locked':          'Locked',
    'recolte.choose_resource': '＋ Choose',
    'recolte.tap_to_harvest':  '▶ Harvest',
    'recolte.change':          '✏️ Change',
    'recolte.select_resource': 'Select a resource',
    'recolte.close':           'Close',
    'recolte.unlock_slot':     'Unlock slot',
    'recolte.you_have':        'You have',
    'recolte.required':        'required',
    'recolte.unlock_btn':      'Unlock',
    'recolte.cancel':          'Cancel',
    'recolte.ready':           '✅ Ready',
    'recolte.level_req':       'Lv.',
    'recolte.level':           'Lv.',
    'recolte.xp':              'XP',
    'recolte.active_indicator':'●',
    'recolte.back':            '← Back',
    'recolte.back_home':       '← Home',

    // --- HdvPage ---
    'hdv.title':          '🏪 Market',
    'hdv.pnj_name':       'Merchant Kuro',
    'hdv.pnj_subtitle':   'Buys your resources at a fixed price — Testnet',
    'hdv.open':           'OPEN',
    'hdv.select_prompt':  'Select resources to sell:',
    'hdv.in_stock':       'in stock',
    'hdv.per_unit':       '$KIRHA/unit',
    'hdv.sell_all':       'Sell all',
    'hdv.sold':           'Sold ✓',
    'hdv.empty':          'Your inventory is empty.',
    'hdv.go_harvest':     'Go harvest →',
    'hdv.coming_soon':    'On-chain trading coming soon',
    'hdv.back_home':      '← Home',

    // --- BanquePage ---
    'banque.title':           '🏦 Bank',
    'banque.wallet_connected':'Connected wallet',
    'banque.balance_kirha':   '$KIRHA balance',
    'banque.withdraw_title':  '💸 Withdraw $KIRHA',
    'banque.withdraw_avail':  'Available balance',
    'banque.withdraw_all':    'Withdraw all',
    'banque.amount_placeholder': 'Amount...',
    'banque.save_title':      '💾 On-chain save',
    'banque.save_pending':    'resource(s) to save',
    'banque.save_none':       'No pending resources',
    'banque.save_last':       'Last save',
    'banque.save_never':      'Never',
    'banque.save_btn':        '💾 Save',
    'banque.save_signing':    '✍️ Signing…',
    'banque.save_pending_tx': '⏳ Transaction in progress…',
    'banque.save_success':    '✅ Saved!',
    'banque.vip_title':       'VIP Subscription',
    'banque.vip_desc':        'Coming soon — Harvest bonuses and extra slots',
    'banque.coming_soon':     'Coming soon',
    'banque.back_home':       '← Home',

    // --- MaisonPage ---
    'maison.title':       '🏠 Home',
    'maison.tab_res':     '📦 Resources',
    'maison.tab_metiers': '⚔️ Professions',
    'maison.tab_perso':   '👗 Character',
    'maison.sort_qty':    '# Quantity',
    'maison.sort_cat':    '📂 Category',
    'maison.empty':       'Inventory empty',
    'maison.go_harvest':  'Go harvest →',
    'maison.xp_total':    'Total XP',
    'maison.perso_title': 'Character & Outfits',
    'maison.perso_desc':  'Coming soon — Equip your character for harvest bonuses',
    'maison.back_home':   '← Home',
    'maison.level':       'Lv.',

    // --- CraftPage ---
    'craft.title':     '⚗️ Craft',
    'craft.heading':   'Crafting Workshop',
    'craft.desc':      'Transform your resources into powerful items.',
    'craft.desc2':     'Coming soon.',
    'craft.wip':       '🚧 In development',
    'craft.back_home': '← Home',

    // --- BottomMenu Inventaire ---
    'inventory.title':       '🎒 Inventory',
    'inventory.tab_res':     '📦 Resources',
    'inventory.tab_perso':   '👗 Character',
    'inventory.sort_qty':    '# Quantity',
    'inventory.sort_cat':    '📂 Category',
    'inventory.empty':       'No resources harvested yet.',
    'inventory.perso_title': 'Character & Outfits',
    'inventory.perso_desc':  'Coming soon — Equip your character',

    // --- SettingsModal ---
    'settings.title':         '⚙️ Settings',
    'settings.language':      'Language',
    'settings.save':          'On-chain save',
    'settings.kirha_price':   '$KIRHA price',
    'settings.kirha_approx':  '1 $KIRHA ≈',
    'settings.transfer':      '$KIRHA transfer',
    'settings.transfer_desc': 'Transfer available from the Bank →',
    'settings.bank_link':     'Bank',
    'settings.city_id':       'City ID (NFT)',
    'settings.city_prefix':   '🏙️ City #',
    'settings.account':       'Account',
    'settings.disconnect':    '🚪 Sign out',
    'settings.save_pending':  'pending',
    'settings.save_signing':  '✍️ Signing required...',
    'settings.save_pending_tx': '⏳ Transaction in progress...',
    'settings.save_success':  '✅ Saved!',
    'settings.save_error':    '❌ Error — Retry',
    'settings.save_btn':      '💾 Save',

    // --- TemplePage ---
    'home.card_temple':      'Temple',
    'home.card_temple_desc': 'Daily quests',
    'temple.title':          'Temple of Offerings',
    'temple.subtitle':       'Daily offerings — reset at midnight UTC',
    'temple.quest_label':    'Offer',
    'temple.completed':      'Completed ✓',
    'temple.insufficient':   'Insufficient resources',
    'temple.reset_in':       'Resets in',

    // --- Métiers ---
    'metier.bucheron':        'Lumberjack',
    'metier.paysan':          'Farmer',
    'metier.pecheur':         'Fisher',
    'metier.mineur':          'Miner',
    'metier.alchimiste':      'Alchemist',
    'metier.bucheron_desc':   'Trees & precious wood',
    'metier.paysan_desc':     'Crops & farming',
    'metier.pecheur_desc':    'Fish & sea creatures',
    'metier.mineur_desc':     'Ores & gems',
    'metier.alchimiste_desc': 'Herbs & magic plants',

    // --- Commun ---
    'common.level':       'Lv.',
    'common.saving':      '⏳ Transaction in progress…',
    'common.signing':     '✍️ Signing…',
    'common.saved':       '✅ Saved!',
    'common.error_retry': '❌ Error — Retry',
    'common.save_count':  '💾 Save',
    'common.never':       'Never',
  },
} as const;

type Lang = keyof typeof TRANSLATIONS;
type TranslationKey = keyof typeof TRANSLATIONS['fr'];

export function useT() {
  const langue = useGameStore(s => s.langue);
  const lang = langue as Lang;

  function t(key: TranslationKey, vars?: Record<string, string | number>): string {
    const text = (TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS['fr'][key] ?? key) as string;
    if (!vars) return text;
    return Object.entries(vars).reduce(
      (acc, [k, v]) => acc.replace(`{${k}}`, String(v)), text
    );
  }

  return { t, lang };
}
