#!/usr/bin/env bash
# Push fiable + vérification GitHub Pages (retry push et redéploiement si erreur).
set -euo pipefail

REPO="Veayce0x3/To-Kirha"
BRANCH="${1:-main}"
MAX_PUSH=3
MAX_PAGES_WAIT=36

cd "$(dirname "$0")/.."

echo "→ git push origin ${BRANCH}"
pushed=false
for attempt in $(seq 1 "$MAX_PUSH"); do
  if git push origin "$BRANCH"; then
    pushed=true
    break
  fi
  echo "   push tentative ${attempt}/${MAX_PUSH} échouée, nouvel essai dans 3s…"
  sleep 3
done

if [ "$pushed" != true ]; then
  echo "✗ push impossible après ${MAX_PUSH} tentatives"
  exit 1
fi
echo "✓ push OK"

if ! command -v gh >/dev/null 2>&1; then
  echo "gh absent — déploiement Pages non vérifié"
  exit 0
fi

echo "→ attente déploiement GitHub Pages…"
for i in $(seq 1 "$MAX_PAGES_WAIT"); do
  status=$(gh api "repos/${REPO}/pages/builds" --jq '.[0].status' 2>/dev/null || echo "unknown")
  commit=$(gh api "repos/${REPO}/pages/builds" --jq '.[0].commit[0:8]' 2>/dev/null || echo "?")
  echo "   [${i}/${MAX_PAGES_WAIT}] build: ${status} (${commit})"

  case "$status" in
    built)
      echo "✓ GitHub Pages déployé"
      exit 0
      ;;
    errored)
      echo "✗ build Pages en erreur — redéclenchement via commit vide…"
      git commit --allow-empty -m "chore: redéclencher déploiement GitHub Pages"
      git push origin "$BRANCH"
      sleep 12
      ;;
  esac
  sleep 8
done

echo "⚠ déploiement Pages encore en cours (voir Actions sur GitHub)"
exit 0
