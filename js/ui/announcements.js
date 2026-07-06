import { fetchActiveAnnouncements } from '../systems/admin.js';

export async function mountAnnouncementBanner(container) {
  if (!container) return;
  const res = await fetchActiveAnnouncements();
  const rows = Array.isArray(res.data) ? res.data : [];
  if (!rows.length) {
    container.innerHTML = '';
    container.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');
  container.innerHTML = rows.map((a) => `
    <div class="announcement-banner kind-${a.kind || 'info'}" role="status">
      <strong>${a.title}</strong> — ${a.body}
    </div>
  `).join('');
}
