/**
 * Livre de Cuisine — recettes découvertes (craftées au moins 1×).
 */

export function emptyCookbookState() {
  return { discovered: [] };
}

export function ensureCookbookState(state) {
  if (!state.cookbook || typeof state.cookbook !== 'object') {
    state.cookbook = emptyCookbookState();
  }
  if (!Array.isArray(state.cookbook.discovered)) state.cookbook.discovered = [];
  return state.cookbook;
}

export function discoverCookbookRecipe(state, recipeId) {
  if (!recipeId) return false;
  const book = ensureCookbookState(state);
  if (book.discovered.includes(recipeId)) return false;
  book.discovered.push(recipeId);
  return true;
}

export function isCookbookRecipeDiscovered(state, recipeId) {
  return ensureCookbookState(state).discovered.includes(recipeId);
}

export const RECIPE_QUALITY = {
  bronze: { id: 'bronze', label: 'Simple', emoji: '🥉' },
  silver: { id: 'silver', label: 'Élaborée', emoji: '🥈' },
  gold: { id: 'gold', label: 'Raffinée', emoji: '🥇' },
  master: { id: 'master', label: 'Maître', emoji: '👑' },
};

/** Qualité selon niveau métier requis (ou mealTier). */
export function getRecipeQuality(recipe, resource = null) {
  if (recipe?.quality && RECIPE_QUALITY[recipe.quality]) return RECIPE_QUALITY[recipe.quality];
  const lv = Number(recipe?.requiredJobLevel) || 1;
  const tier = Number(resource?.mealTier) || 0;
  const score = Math.max(lv, Math.floor(tier / 10) || 0);
  if (score >= 80) return RECIPE_QUALITY.master;
  if (score >= 30) return RECIPE_QUALITY.gold;
  if (score >= 8) return RECIPE_QUALITY.silver;
  return RECIPE_QUALITY.bronze;
}

export function getCuisineRecipes(recipes) {
  return Object.values(recipes || {}).filter((r) => (
    r?.craftJob === 'baker'
    || r?.craftJob === 'fishmonger'
    || r?.craftJob === 'chemist'
  ));
}

export function getCookbookViewModel(state, recipes, resources, balance, getMealEffectFn) {
  ensureCookbookState(state);
  const jobs = {
    baker: { label: 'Boulanger', emoji: '🍞' },
    fishmonger: { label: 'Poissonnier', emoji: '🎣' },
    chemist: { label: 'Chimiste', emoji: '🧪' },
  };

  const list = getCuisineRecipes(recipes).map((recipe) => {
    const out = recipe.output ? resources?.[recipe.output] : null;
    const discovered = isCookbookRecipeDiscovered(state, recipe.id);
    const quality = getRecipeQuality(recipe, out);
    const effect = out && getMealEffectFn
      ? getMealEffectFn(recipe.output, resources, balance)
      : null;
    return {
      recipe,
      output: out,
      discovered,
      quality,
      effectLabel: effect?.label || recipe.description || '',
      job: jobs[recipe.craftJob] || { label: recipe.craftJob, emoji: '🍳' },
    };
  }).sort((a, b) => {
    const jobOrder = { baker: 0, fishmonger: 1, chemist: 2 };
    const ja = jobOrder[a.recipe.craftJob] ?? 9;
    const jb = jobOrder[b.recipe.craftJob] ?? 9;
    if (ja !== jb) return ja - jb;
    return (a.recipe.requiredJobLevel || 0) - (b.recipe.requiredJobLevel || 0);
  });

  const total = list.length;
  const found = list.filter((x) => x.discovered).length;

  return { entries: list, total, found, jobs };
}
