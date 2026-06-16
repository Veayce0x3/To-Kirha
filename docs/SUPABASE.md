# Supabase — Préparation cloud save (Phase 5+)

> Structure préparée, **non implémentée**. Ce doc sert de guide pour l'intégration future.

## Architecture actuelle

```
js/core/save.js
├── SaveProvider        → localStorage (actif)
├── CloudSaveProvider   → stub Supabase (inactif)
└── createSaveProvider(type) → 'local' | 'cloud'
```

## Migration prévue

### 1. Config Supabase

Créer un projet Supabase et une table `saves` :

```sql
create table saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  save_data jsonb not null,
  updated_at timestamptz default now(),
  unique(user_id)
);
```

### 2. Variables d'environnement

```javascript
// js/config.js (à créer)
export const SUPABASE_URL = 'https://xxx.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJ...';
```

Ne jamais committer les clés — utiliser GitHub Secrets pour CI.

### 3. Implémenter CloudSaveProvider

```javascript
import { createClient } from '@supabase/supabase-js';

export const CloudSaveProvider = {
  async save(data) {
    const { error } = await supabase
      .from('saves')
      .upsert({ user_id: userId, save_data: data, updated_at: new Date() });
    return !error;
  },
  async load() {
    const { data } = await supabase.from('saves').select('save_data').single();
    return data?.save_data ?? null;
  },
};
```

### 4. Basculer le provider

```javascript
// js/main.js — futur
const providerType = userLoggedIn ? 'cloud' : 'local';
const saveProvider = createSaveProvider(providerType);
```

### 5. Sync local ↔ cloud

- Au login : charger cloud, merge avec local si plus récent
- À chaque save : local + cloud en parallèle
- Au logout : garder local comme fallback

## Fichiers à modifier (quand prêt)

- `js/core/save.js` — implémenter CloudSaveProvider
- `js/core/game.js` — injecter provider au constructeur
- `js/ui/render.js` — écran login/compte
- `index.html` — bouton connexion

## Dépendances futures

```bash
npm install @supabase/supabase-js
```
