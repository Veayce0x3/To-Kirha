import { emit } from '../core/events.js';

let currentView = 'character';

const categoryCollapsed = {};

export const CRAFT_NAV = [
  { id: 'toolmaker', emoji: '🛠️', label: 'Outilleur', category: 'outillage' },
  { id: 'blacksmith', emoji: '🔨', label: 'Forgeron', category: 'artisanat' },
  { id: 'carver', emoji: '🪵', label: 'Sculpteur', category: 'artisanat' },
  { id: 'armorer', emoji: '🥋', label: 'Armurier', category: 'artisanat' },
  { id: 'tailor', emoji: '🧵', label: 'Tailleur', category: 'artisanat' },
  { id: 'shoemaker', emoji: '👢', label: 'Cordonnier', category: 'artisanat' },
  { id: 'jeweler', emoji: '💍', label: 'Bijoutier', category: 'artisanat' },
];

function craftViewId(jobId) {
  return `workshop_${jobId}`;
}

const CRAFT_VIEWS = Object.fromEntries(
  CRAFT_NAV.map(({ id, emoji, label }) => [
    craftViewId(id),
    { id: craftViewId(id), label, emoji, title: label, craftJob: id },
  ])
);

export const VIEWS = {
  character: { id: 'character', label: 'Perso', title: 'Personnage' },
  world: { id: 'world', label: 'Monde', title: 'Monde' },
  missions: { id: 'missions', label: 'Missions', title: 'Missions' },
  job_lumberjack: { id: 'job_lumberjack', label: 'Bûcheron', title: 'Bûcheron', job: 'lumberjack' },
  job_fisher: { id: 'job_fisher', label: 'Pêcheur', title: 'Pêcheur', job: 'fisher' },
  job_miner: { id: 'job_miner', label: 'Mineur', title: 'Mineur', job: 'miner' },
  job_farmer: { id: 'job_farmer', label: 'Paysan', title: 'Paysan', job: 'farmer' },
  job_alchemist: { id: 'job_alchemist', label: 'Alchimiste', title: 'Alchimiste', job: 'alchemist' },
  inventory: { id: 'inventory', label: 'Banque', title: 'Banque' },
  auction_house: { id: 'auction_house', label: 'Hôtel des Ventes', title: 'Hôtel des Ventes' },
  combat: { id: 'combat', label: 'Combat', title: 'Combat' },
  workshop: { id: 'workshop', label: 'Atelier', title: 'Atelier' },
  options: { id: 'options', label: 'Options', title: 'Options' },
  ...CRAFT_VIEWS,
};

export const NAV_CATEGORIES = [
  {
    id: 'personnage',
    label: 'Personnage',
    collapsible: false,
    items: ['character'],
  },
  {
    id: 'monde',
    label: 'Monde',
    collapsible: false,
    items: ['missions', 'world'],
  },
  {
    id: 'recolte',
    label: 'Récolte',
    collapsible: true,
    defaultOpen: true,
    items: ['job_lumberjack', 'job_fisher', 'job_miner', 'job_farmer', 'job_alchemist'],
  },
  {
    id: 'artisanat',
    label: 'Atelier',
    collapsible: false,
    items: ['workshop'],
  },
  {
    id: 'gestion',
    label: 'Gestion',
    collapsible: true,
    defaultOpen: true,
    items: ['inventory', 'auction_house', 'combat'],
  },
];

export const SIDEBAR_FOOTER = ['options'];

export const JOB_VIEW_MAP = {
  lumberjack: 'job_lumberjack',
  fisher: 'job_fisher',
  miner: 'job_miner',
  farmer: 'job_farmer',
  alchemist: 'job_alchemist',
  toolmaker: 'workshop_toolmaker',
  blacksmith: 'workshop_blacksmith',
  carver: 'workshop_carver',
  armorer: 'workshop_armorer',
  tailor: 'workshop_tailor',
  shoemaker: 'workshop_shoemaker',
  jeweler: 'workshop_jeweler',
};

export function getCraftJobFromView(viewId) {
  const view = VIEWS[viewId];
  return view?.craftJob || null;
}

export function isWorkshopView(viewId) {
  return viewId.startsWith('workshop_');
}

export function navigate(viewId) {
  if (!VIEWS[viewId]) return;
  currentView = viewId;
  emit('navigate', viewId);
}

export function getView() {
  return currentView;
}

export function getViewTitle(viewId = currentView) {
  return VIEWS[viewId]?.title || 'To-Kirha';
}

export function getNavCategories() {
  return NAV_CATEGORIES;
}

export function isCategoryCollapsed(catId) {
  const cat = NAV_CATEGORIES.find((c) => c.id === catId);
  if (!cat?.collapsible) return false;
  if (catId in categoryCollapsed) return categoryCollapsed[catId];
  return cat.defaultOpen === false;
}

export function toggleCategory(catId) {
  categoryCollapsed[catId] = !isCategoryCollapsed(catId);
}

export function closeMobileSidebar() {
  emit('sidebarClose');
}
