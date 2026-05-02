import { ADMIN_RELAYER_URL } from '../config/admin';

export async function postAdminRelayer(
  action: string,
  token: string,
  body: Record<string, string>,
): Promise<{ success?: boolean; txHash?: string }> {
  const res = await fetch(`${ADMIN_RELAYER_URL}/admin/${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Token': token,
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; success?: boolean; txHash?: string };
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}
