import { emit } from '../core/events.js';
import { FARM_BUILDING_IDS, FARM_BUILDING_LABELS } from '../systems/farm.js';

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

function farmViewId(buildingId) {
  return `farm_${buildingId}`;
}

const CRAFT_VIEWS = Object.fromEntries(
  CRAFT_NAV.map(({ id, emoji, label }) => [
    craftViewId(id),
    { id: craftViewId(id), label, emoji, title: label, craftJob: id },
  ])
);

const FARM_VIEWS = Object.fromEntries(
  FARM_BUILDING_IDS.map((id) => [
    farmViewId(id),
    {
      id: farmViewId(id),
      label: FARM_BUILDING_LABELS[id] || id,
      title: FARM_BUILDING_LABELS[id] || id,
      building: id,
    },
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
  cuisine: { id: 'cuisine', label: 'Cuisine', title: 'Cuisine', emoji: '👨‍🍳', job: 'cook' },
  options: { id: 'options', label: 'Options', title: 'Options' },
  ...CRAFT_VIEWS,
  ...FARM_VIEWS,
};

export const FARM_BUILDING_VIEWS = FARM_BUILDING_IDS.map(farmViewId);

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
    id: 'ferme',
    label: 'Ferme',
    collapsible: true,
    defaultOpen: true,
    items: FARM_BUILDING_VIEWS,
  },
  {
    id: 'artisanat',
    label: 'Atelier',
    collapsible: false,
    items: ['workshop'],
  },
  {
    id: 'cuisine',
    label: 'Cuisine',
    collapsible: false,
    items: ['cuisine'],
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
  cook: 'cuisine',
};

export const HARVEST_JOB_VIEWS = [
  'job_lumberjack',
  'job_fisher',
  'job_miner',
  'job_farmer',
  'job_alchemist',
];

export function getAdjacentHarvestView(viewId, direction) {
  const idx = HARVEST_JOB_VIEWS.indexOf(viewId);
  if (idx < 0) return null;
  const next = (idx + direction + HARVEST_JOB_VIEWS.length) % HARVEST_JOB_VIEWS.length;
  return HARVEST_JOB_VIEWS[next];
}

export function getAdjacentFarmView(viewId, direction) {
  const idx = FARM_BUILDING_VIEWS.indexOf(viewId);
  if (idx < 0) return null;
  const next = (idx + direction + FARM_BUILDING_VIEWS.length) % FARM_BUILDING_VIEWS.length;
  return FARM_BUILDING_VIEWS[next];
}

export function getHarvestViewForJob(jobId) {
  return JOB_VIEW_MAP[jobId] || null;
}

export function getFarmViewForBuilding(buildingId) {
  return farmViewId(buildingId);
}

export function getBuildingFromFarmView(viewId) {
  if (!viewId?.startsWith('farm_')) return null;
  return viewId.slice(5);
}

export function isFarmView(viewId) {
  return viewId?.startsWith('farm_');
}

export function getCraftJobFromView(viewId) {
  if (viewId === 'cuisine') return 'cook';
  const view = VIEWS[viewId];
  return view?.craftJob || null;
}

export function isCuisineView(viewId) {
  return viewId === 'cuisine';
}

export function isWorkshopView(viewId) {
  return viewId === 'workshop' || (viewId.startsWith('workshop_') && viewId !== 'workshop_cook');
}

export function navigate(viewId) {
  if (viewId === 'workshop_cook') viewId = 'cuisine';
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
