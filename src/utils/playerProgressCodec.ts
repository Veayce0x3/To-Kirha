import type { GameState, ActiveBuff } from '../store/gameStore';

/** Données persistantes on-chain (hors inventaire / métiers récolte / soldes — lus depuis les mappings). */
export interface SerializedPlayerProgressV1 {
  v: 1;
  slots:               GameState['slots'];
  templeCompletedDate: string;
  templeCompleted:     number[];
  templeResetUsed:     number;
  templeResetDate:     string;
  templeSlotRerolls:   number[];
  personageNiveau:     number;
  personageXp:         number;
  personageXpTotal:    number;
  competencesPoints:   number;
  competences:         GameState['competences'];
  puitsDerniereRecolte: number;
  animauxDerniereRecolte: Record<string, number[]>;
  outils:              GameState['outils'];
  craftMetiers:        GameState['craftMetiers'];
  parcheminsLv100LastDate: string;
  activeBuffs:         ActiveBuff[];
  prestige:            GameState['prestige'];
  meubles_poses:       number[];
  artefacts:           GameState['artefacts'];
  equipement:          GameState['equipement'];
}

export function pickProgressForSave(state: GameState): SerializedPlayerProgressV1 {
  return {
    v: 1,
    slots:               state.slots,
    templeCompletedDate: state.templeCompletedDate,
    templeCompleted:     state.templeCompleted,
    templeResetUsed:     state.templeResetUsed,
    templeResetDate:     state.templeResetDate,
    templeSlotRerolls:   state.templeSlotRerolls,
    personageNiveau:     state.personageNiveau,
    personageXp:         state.personageXp,
    personageXpTotal:    state.personageXpTotal,
    competencesPoints:   state.competencesPoints,
    competences:         state.competences,
    puitsDerniereRecolte: state.puitsDerniereRecolte,
    animauxDerniereRecolte: state.animauxDerniereRecolte,
    outils:              state.outils,
    craftMetiers:        state.craftMetiers,
    parcheminsLv100LastDate: state.parcheminsLv100LastDate,
    activeBuffs:         state.activeBuffs,
    prestige:            state.prestige,
    meubles_poses:       state.meubles_poses,
    artefacts:           state.artefacts,
    equipement:          state.equipement,
  };
}

export function parsePlayerProgressBlob(raw: unknown): SerializedPlayerProgressV1 | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as SerializedPlayerProgressV1;
  if (o.v !== 1 || !o.slots) return null;
  return o;
}
