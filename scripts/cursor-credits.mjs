#!/usr/bin/env node
/**
 * Suivi des crédits Cursor via l'API dashboard (non officielle).
 * Token : copier WorkosCursorSessionToken depuis cursor.com (voir README-credits.md)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

const TOKEN_PATHS = [
  join(process.cwd(), ".cursor/credits-token"),
  join(homedir(), "Library/Application Support/cursor-usage/config.json"),
  join(homedir(), ".config/cursor-usage/config.json"),
];

const API = "https://cursor.com/api";

function loadToken() {
  if (process.env.CURSOR_SESSION_TOKEN) return process.env.CURSOR_SESSION_TOKEN.trim();

  for (const p of TOKEN_PATHS) {
    if (!existsSync(p)) continue;
    const raw = readFileSync(p, "utf8");
    try {
      const json = JSON.parse(raw);
      if (json.token) return json.token.trim();
    } catch {
      const trimmed = raw.trim();
      if (trimmed) return trimmed;
    }
  }
  return null;
}

function saveToken(token) {
  const path = join(process.cwd(), ".cursor/credits-token");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, token.trim(), "utf8");
  console.log(`Token enregistré dans ${path}`);
}

async function api(path, options = {}) {
  const token = loadToken();
  if (!token) {
    console.error(`
❌ Token Cursor manquant.

1. Ouvre https://cursor.com/dashboard/usage dans Chrome
2. DevTools (F12) → Application → Cookies → cursor.com
3. Copie la valeur de "WorkosCursorSessionToken"
4. Lance : npm run credits -- set-token VOTRE_TOKEN

Ou exporte : export CURSOR_SESSION_TOKEN="..."
`);
    process.exit(1);
  }

  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Cookie: `WorkosCursorSessionToken=${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

function fmtDate(ms) {
  if (!ms) return "—";
  return new Date(Number(ms)).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

function pct(used, limit) {
  if (!limit || limit <= 0) return "—";
  return `${Math.round((used / limit) * 100)}%`;
}

async function showSummary() {
  const data = await api("/usage-summary");
  const plan = data.individualUsage ?? data.teamUsage ?? data;
  const used = plan?.planUsed ?? plan?.used ?? 0;
  const limit = plan?.planLimit ?? plan?.limit ?? 0;
  const bonus = plan?.planBonus ?? 0;
  const total = limit + bonus;
  const onDemand = data.onDemandUsage ?? {};

  console.log("\n🌸 Cursor — Résumé crédits\n");
  console.log(`  Plan          : ${data.membershipType ?? "—"}`);
  console.log(`  Période       : ${fmtDate(data.billingCycleStart)} → ${fmtDate(data.billingCycleEnd)}`);
  console.log(`  Inclus        : ${used} / ${limit} (${pct(used, limit)})`);
  if (bonus) console.log(`  Bonus         : +${bonus} (total ${total})`);
  if (onDemand.used != null) {
    const odLimit = onDemand.limit === -1 || onDemand.limit == null ? "illimité" : onDemand.limit;
    console.log(`  On-demand     : ${onDemand.used} / ${odLimit}`);
  }
  console.log(`\n  Dashboard     : https://cursor.com/dashboard/usage\n`);
}

async function showEvents(limit = 10) {
  const now = Date.now();
  const start = now - 7 * 24 * 60 * 60 * 1000;
  const data = await api("/dashboard/get-filtered-usage-events", {
    method: "POST",
    body: JSON.stringify({
      startDate: String(start),
      endDate: String(now),
      page: 1,
      pageSize: limit,
    }),
  });

  const events = data.usageEventsDisplay ?? data.events ?? [];
  console.log(`\n🌸 Dernières requêtes (${events.length})\n`);
  for (const e of events) {
    const cost = e.chargedCents != null ? `$${(e.chargedCents / 100).toFixed(2)}` : "inclus";
    console.log(`  ${fmtDate(e.timestamp)}  ${(e.model ?? "—").padEnd(28)}  ${cost}`);
  }
  console.log();
}

const [,, cmd, arg] = process.argv;

try {
  if (cmd === "set-token" && arg) {
    saveToken(arg);
  } else if (cmd === "events") {
    await showEvents();
  } else {
    await showSummary();
  }
} catch (err) {
  console.error("Erreur:", err.message);
  if (err.message.includes("401") || err.message.includes("403")) {
    console.error("Token expiré — recopie-le depuis le navigateur.");
  }
  process.exit(1);
}
