import { fetchActiveAnnouncements } from '../systems/admin.js';

const DISMISS_KEY = 'to-kirha-dismissed-announcements';
const POLL_MS = 2 * 60 * 1000;

let pollTimer = null;
let bannerContainer = null;
let cachedRows = [];

function readDismissed() {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function writeDismissed(ids) {
  try {
    localStorage.setItem(DISMISS_KEY, JSON.stringify(ids.slice(-40)));
  } catch {
    /* ignore quota */
  }
}

function dismissAnnouncement(id) {
  if (!id) return;
  const ids = readDismissed();
  if (!ids.includes(String(id))) {
    ids.push(String(id));
    writeDismissed(ids);
  }
  if (bannerContainer) paintBanners(bannerContainer, cachedRows);
}

function paintBanners(container, rows) {
  if (Array.isArray(rows)) cachedRows = rows;
  const dismissed = new Set(readDismissed());
  const visible = (cachedRows || []).filter((a) => a?.id != null && !dismissed.has(String(a.id)));
  if (!visible.length) {
    container.innerHTML = '';
    container.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');
  container.innerHTML = visible.map((a) => `
    <div class="announcement-banner kind-${a.kind || 'info'}" role="status" data-ann-id="${a.id}">
      <div class="announcement-banner-body">
        <strong>${a.title}</strong>
        <span class="announcement-banner-text">${a.body}</span>
      </div>
      <button type="button" class="announcement-dismiss" data-dismiss-ann="${a.id}" aria-label="Fermer l’annonce">✕</button>
    </div>
  `).join('');

  container.querySelectorAll('[data-dismiss-ann]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dismissAnnouncement(btn.getAttribute('data-dismiss-ann'));
    });
  });
}

async function refreshAnnouncementBanner(container = bannerContainer) {
  if (!container) return;
  try {
    const res = await fetchActiveAnnouncements();
    const rows = Array.isArray(res?.data) ? res.data : [];
    paintBanners(container, rows);
  } catch {
    /* silencieux : online optionnel */
  }
}

function startAnnouncementPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    if (document.visibilityState === 'hidden') return;
    refreshAnnouncementBanner();
  }, POLL_MS);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshAnnouncementBanner();
  });
}

export async function mountAnnouncementBanner(container) {
  if (!container) return;
  bannerContainer = container;
  await refreshAnnouncementBanner(container);
  startAnnouncementPolling();
}

export { refreshAnnouncementBanner };
