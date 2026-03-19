const COUNTER_KEY = 'kirha_next_city_id';
const CITY_KEY    = 'kirha_city_id';

export function getOrCreateCityId(): string {
  const existing = localStorage.getItem(CITY_KEY);
  if (existing) return existing;
  const next = (parseInt(localStorage.getItem(COUNTER_KEY) ?? '0', 10)) + 1;
  localStorage.setItem(COUNTER_KEY, next.toString());
  localStorage.setItem(CITY_KEY, next.toString());
  return next.toString();
}

export function assignNewCityId(): string {
  const next = (parseInt(localStorage.getItem(COUNTER_KEY) ?? '0', 10)) + 1;
  localStorage.setItem(COUNTER_KEY, next.toString());
  localStorage.setItem(CITY_KEY, next.toString());
  return next.toString();
}

export function hasCityId(): boolean {
  return localStorage.getItem(CITY_KEY) !== null;
}
