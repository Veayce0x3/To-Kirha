// ============================================================
// Vêtements NFT — ERC-1155 IDs 100-124
// Chaque vêtement donne un bonus de jeu.
// Mint/achat via KirhaGame.sol (à implémenter).
// ============================================================

export type TypeVetement = 'haut' | 'bas' | 'chaussures' | 'chapeau' | 'accessoire';
export type Rarete       = 'commun' | 'rare' | 'epique' | 'legendaire';
export type TypeBonus    = 'vitesse_recolte' | 'xp_bonus' | 'chance_rare' | 'slots_bonus';

export interface Bonus {
  type:   TypeBonus;
  valeur: number; // % pour vitesse/xp/chance, entier pour slots
}

export interface Vetement {
  id:         number;       // ERC-1155 ID (100–124)
  nom:        string;
  type:       TypeVetement;
  rarete:     Rarete;
  bonus:      Bonus;
  prix_kirha: number;
  image:      string;       // chemin relatif à /assets/personnage/vetements/{type}/
}

const BASE = import.meta.env.BASE_URL;
const DOSSIER: Record<TypeVetement, string> = {
  haut: 'haut', bas: 'bas', chaussures: 'chaussures', chapeau: 'chapeau', accessoire: 'accessoires',
};
const img = (type: TypeVetement, file: string) =>
  `${BASE}assets/personnage/vetements/${DOSSIER[type]}/${file}`;

export const VETEMENTS: Vetement[] = [
  // ── Hauts (100–104) ───────────────────────────────────────
  { id: 100, nom: 'Chemise du Bûcheron',    type: 'haut', rarete: 'commun',    bonus: { type: 'vitesse_recolte', valeur:  5 }, prix_kirha:   50, image: img('haut', 'chemise_bucheron.png') },
  { id: 101, nom: 'Tunique Forestière',     type: 'haut', rarete: 'commun',    bonus: { type: 'xp_bonus',         valeur:  8 }, prix_kirha:   60, image: img('haut', 'tunique_forestiere.png') },
  { id: 102, nom: 'Veste Sakura',           type: 'haut', rarete: 'rare',      bonus: { type: 'vitesse_recolte', valeur: 12 }, prix_kirha:  200, image: img('haut', 'veste_sakura.png') },
  { id: 103, nom: 'Kimono de Récolte',      type: 'haut', rarete: 'epique',    bonus: { type: 'vitesse_recolte', valeur: 20 }, prix_kirha:  800, image: img('haut', 'kimono_recolte.png') },
  { id: 104, nom: 'Manteau du Grand Maître',type: 'haut', rarete: 'legendaire',bonus: { type: 'xp_bonus',         valeur: 35 }, prix_kirha: 3000, image: img('haut', 'manteau_grand_maitre.png') },

  // ── Bas (105–109) ─────────────────────────────────────────
  { id: 105, nom: 'Pantalon Simple',        type: 'bas', rarete: 'commun',    bonus: { type: 'vitesse_recolte', valeur:  3 }, prix_kirha:   30, image: img('bas', 'pantalon_simple.png') },
  { id: 106, nom: 'Hakama du Paysan',       type: 'bas', rarete: 'commun',    bonus: { type: 'vitesse_recolte', valeur:  5 }, prix_kirha:   50, image: img('bas', 'hakama_paysan.png') },
  { id: 107, nom: 'Pantalon Renforcé',      type: 'bas', rarete: 'rare',      bonus: { type: 'vitesse_recolte', valeur: 10 }, prix_kirha:  180, image: img('bas', 'pantalon_renforce.png') },
  { id: 108, nom: 'Hakama Sakura',          type: 'bas', rarete: 'epique',    bonus: { type: 'vitesse_recolte', valeur: 18 }, prix_kirha:  700, image: img('bas', 'hakama_sakura.png') },
  { id: 109, nom: 'Pantalon Légendaire',    type: 'bas', rarete: 'legendaire',bonus: { type: 'vitesse_recolte', valeur: 30 }, prix_kirha: 2500, image: img('bas', 'pantalon_legendaire.png') },

  // ── Chaussures (110–114) ──────────────────────────────────
  { id: 110, nom: 'Sandales Simples',       type: 'chaussures', rarete: 'commun',    bonus: { type: 'vitesse_recolte', valeur:  4 }, prix_kirha:   25, image: img('chaussures', 'sandales_simples.png') },
  { id: 111, nom: 'Geta Bois',              type: 'chaussures', rarete: 'commun',    bonus: { type: 'vitesse_recolte', valeur:  6 }, prix_kirha:   40, image: img('chaussures', 'geta_bois.png') },
  { id: 112, nom: 'Tabi Renforcés',         type: 'chaussures', rarete: 'rare',      bonus: { type: 'vitesse_recolte', valeur: 12 }, prix_kirha:  160, image: img('chaussures', 'tabi_renforces.png') },
  { id: 113, nom: 'Waraji Sakura',          type: 'chaussures', rarete: 'epique',    bonus: { type: 'vitesse_recolte', valeur: 20 }, prix_kirha:  650, image: img('chaussures', 'waraji_sakura.png') },
  { id: 114, nom: 'Sandales Célestes',      type: 'chaussures', rarete: 'legendaire',bonus: { type: 'vitesse_recolte', valeur: 35 }, prix_kirha: 2800, image: img('chaussures', 'sandales_celestes.png') },

  // ── Chapeaux (115–119) ────────────────────────────────────
  { id: 115, nom: 'Kasa Simple',            type: 'chapeau', rarete: 'commun',    bonus: { type: 'xp_bonus',      valeur:  5 }, prix_kirha:   35, image: img('chapeau', 'kasa_simple.png') },
  { id: 116, nom: 'Bandeau Forestier',      type: 'chapeau', rarete: 'commun',    bonus: { type: 'chance_rare',   valeur:  3 }, prix_kirha:   45, image: img('chapeau', 'bandeau_forestier.png') },
  { id: 117, nom: 'Chapeau Sakura',         type: 'chapeau', rarete: 'rare',      bonus: { type: 'xp_bonus',      valeur: 15 }, prix_kirha:  190, image: img('chapeau', 'chapeau_sakura.png') },
  { id: 118, nom: 'Kasa Épique',            type: 'chapeau', rarete: 'epique',    bonus: { type: 'xp_bonus',      valeur: 25 }, prix_kirha:  750, image: img('chapeau', 'kasa_epique.png') },
  { id: 119, nom: 'Couronne du Shogun',     type: 'chapeau', rarete: 'legendaire',bonus: { type: 'xp_bonus',      valeur: 40 }, prix_kirha: 3200, image: img('chapeau', 'couronne_shogun.png') },

  // ── Accessoires (120–124) ─────────────────────────────────
  { id: 120, nom: 'Ceinture Simple',        type: 'accessoire', rarete: 'commun',    bonus: { type: 'slots_bonus',   valeur: 1 }, prix_kirha:   80,  image: img('accessoire', 'ceinture_simple.png') },
  { id: 121, nom: 'Sac à Dos',              type: 'accessoire', rarete: 'commun',    bonus: { type: 'slots_bonus',   valeur: 1 }, prix_kirha:  100,  image: img('accessoire', 'sac_dos.png') },
  { id: 122, nom: 'Lanterne Sakura',        type: 'accessoire', rarete: 'rare',      bonus: { type: 'chance_rare',   valeur: 8 }, prix_kirha:  220,  image: img('accessoire', 'lanterne_sakura.png') },
  { id: 123, nom: 'Talisman Doré',          type: 'accessoire', rarete: 'epique',    bonus: { type: 'slots_bonus',   valeur: 2 }, prix_kirha:  900,  image: img('accessoire', 'talisman_dore.png') },
  { id: 124, nom: 'Orbe Légendaire',        type: 'accessoire', rarete: 'legendaire',bonus: { type: 'slots_bonus',   valeur: 3 }, prix_kirha: 4000,  image: img('accessoire', 'orbe_legendaire.png') },

  // ── Tisserand (125–129) — craftés, prix_kirha = 0 ─────────
  { id: 125, nom: 'Kimono Bambou',  type: 'haut',       rarete: 'rare',   bonus: { type: 'xp_bonus',        valeur: 10 }, prix_kirha: 0, image: img('haut',       'kimono_bambou.png') },
  { id: 126, nom: 'Haori Sakura',   type: 'haut',       rarete: 'epique', bonus: { type: 'vitesse_recolte', valeur: 15 }, prix_kirha: 0, image: img('haut',       'haori_sakura.png') },
  { id: 127, nom: 'Hakama Lin',     type: 'bas',        rarete: 'rare',   bonus: { type: 'vitesse_recolte', valeur:  8 }, prix_kirha: 0, image: img('bas',        'hakama_lin.png') },
  { id: 128, nom: 'Kasa Tissé',     type: 'chapeau',    rarete: 'rare',   bonus: { type: 'xp_bonus',        valeur: 12 }, prix_kirha: 0, image: img('chapeau',    'kasa_tisse.png') },
  { id: 129, nom: 'Obi Forgé',      type: 'accessoire', rarete: 'epique', bonus: { type: 'slots_bonus',      valeur:  2 }, prix_kirha: 0, image: img('accessoire', 'obi_forge.png') },
];

// ── Helpers ────────────────────────────────────────────────

export interface Equipement {
  haut?:       number;
  bas?:        number;
  chaussures?: number;
  chapeau?:    number;
  accessoire?: number;
}

export interface BonusTotal {
  vitesse_recolte: number; // % de réduction du temps
  xp_bonus:        number; // % d'XP en plus
  chance_rare:     number; // % de chance de ressource rare
  slots_bonus:     number; // slots supplémentaires
}

export function calculerBonus(equipement: Equipement): BonusTotal {
  const totaux: BonusTotal = { vitesse_recolte: 0, xp_bonus: 0, chance_rare: 0, slots_bonus: 0 };
  const ids = [equipement.haut, equipement.bas, equipement.chaussures, equipement.chapeau, equipement.accessoire];
  for (const id of ids) {
    if (id == null) continue;
    const vet = VETEMENTS.find(v => v.id === id);
    if (!vet) continue;
    totaux[vet.bonus.type] += vet.bonus.valeur;
  }
  return totaux;
}

export const RARETE_COULEUR: Record<Rarete, string> = {
  commun:    '#8bc34a',
  rare:      '#4fc3f7',
  epique:    '#ce93d8',
  legendaire:'#ffca28',
};
