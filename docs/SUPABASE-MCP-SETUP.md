# Connecter Supabase MCP dans Cursor (To-Kirha)

Projet Supabase : **jmakrpkocxlyykgfnmlv**

## Méthode la plus simple (1 clic depuis Supabase)

1. Ouvre ce lien :  
   **https://supabase.com/dashboard/project/jmakrpkocxlyykgfnmlv?showConnect=true&connectTab=mcp**
2. Onglet **MCP** → choisis **Cursor**
3. Suis le bouton d’installation / la config générée
4. Une fenêtre navigateur s’ouvre → connecte-toi à Supabase → **Autoriser**

---

## Méthode manuelle dans Cursor

### Étape 1 — Ouvrir les réglages MCP

Dans **Cursor Desktop** (pas le site web) :

1. Raccourci **`Cmd + ,`** (Mac) ou **`Ctrl + ,`** (Windows/Linux)  
   *ou* menu **Cursor → Settings → Cursor Settings**
2. Dans la barre latérale gauche, cherche **« Tools & MCP »**  
   *(anciennes versions : **Features → MCP**)*

> Si tu ne vois pas « MCP » : mets Cursor à jour (Help → Check for Updates).

### Étape 2 — Ajouter le serveur Supabase

**Option A — Bouton « Add MCP server »**

1. **Tools & MCP** → **+ Add new MCP server** (ou **New MCP Server**)
2. Nom : `Supabase`
3. Type : **HTTP** / **Streamable HTTP**
4. URL :
   ```
   https://mcp.supabase.com/mcp?project_ref=jmakrpkocxlyykgfnmlv
   ```
5. Enregistre

**Option B — Fichier projet**

1. Copie `.cursor/mcp.json.example` vers `.cursor/mcp.json` à la racine du repo
2. Redémarre Cursor
3. Va dans **Tools & MCP** → active le serveur **supabase**

Contenu de `.cursor/mcp.json` :

```json
{
  "mcpServers": {
    "supabase": {
      "url": "https://mcp.supabase.com/mcp?project_ref=jmakrpkocxlyykgfnmlv"
    }
  }
}
```

### Étape 3 — S’authentifier

1. Dans **Tools & MCP**, à côté de **Supabase**, clique **Connect** / **Authenticate** / **Login**
2. Le navigateur s’ouvre → connexion Supabase → choisis l’**organisation** qui contient To-Kirha
3. **Grant access** / Autoriser

Le statut doit passer à **Connected** (vert) avec des outils listés (`execute_sql`, `apply_migration`, etc.).

### Étape 4 — Vérifier

Dans le chat Cursor (mode Agent), demande :

> « Liste les tables Supabase avec MCP »

ou

> « Exécute la migration signup sur Supabase »

---

## Dépannage

| Problème | Solution |
|----------|----------|
| Pas de menu MCP | Mettre à jour Cursor ; utiliser **Cursor Settings** (pas VS Code Settings) |
| `needsAuth` | Cliquer **Authenticate** à côté du serveur Supabase |
| Outils vides | Redémarrer Cursor après auth |
| Mauvais projet | Vérifier `project_ref=jmakrpkocxlyykgfnmlv` dans l’URL |
| Agent cloud sans MCP | L’auth MCP est sur **ta machine Cursor** ; rouvre le chat en local ou relance l’agent après connexion |

---

## Sécurité

- `project_ref` limite l’accès au projet To-Kirha uniquement
- Pour les migrations SQL, retire `read_only=true` (non présent dans notre config)
- Ne mets **jamais** la clé `service_role` dans ce fichier
