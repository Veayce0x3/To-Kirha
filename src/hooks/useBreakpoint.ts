import { useSyncExternalStore } from 'react';

const DESKTOP_MIN_PX = 900;

function subscribeViewport(cb: () => void) {
  const mq = window.matchMedia(`(min-width: ${DESKTOP_MIN_PX}px)`);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}

function getDesktopSnapshot(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(`(min-width: ${DESKTOP_MIN_PX}px)`).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

/** true à partir de 900px — layout desktop (sidebar, grilles élargies). */
export function useBreakpoint() {
  const isDesktop = useSyncExternalStore(subscribeViewport, getDesktopSnapshot, getServerSnapshot);
  return { isDesktop, isMobile: !isDesktop };
}
