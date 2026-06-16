# Suivi des crédits Cursor

## Dans Cursor (intégré)

- **Résumé d'usage** : activé dans tes réglages (`cursor.composer.usageSummaryDisplay: always`)
- **Dashboard officiel** : https://cursor.com/dashboard/usage

## En terminal (ce projet)

```bash
npm run credits              # résumé du cycle de facturation
npm run credits:events       # 10 dernières requêtes (7 jours)
npm run credits -- set-token VOTRE_TOKEN
```

### Obtenir le token (une fois, puis quand il expire)

1. Connecte-toi sur https://cursor.com/dashboard/usage
2. Chrome → DevTools (F12) → Application → Cookies → `cursor.com`
3. Copie `WorkosCursorSessionToken`
4. `npm run credits -- set-token "colle_ici"`

Le token est stocké dans `.cursor/credits-token` (gitignored).

## CLI avancé (optionnel)

Si tu installes [Go](https://go.dev/dl/) :

```bash
go install github.com/dmwyatt/cursor-usage@latest
cursor-usage summary
cursor-usage events --sessions --aggregate
```
