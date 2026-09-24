# Light Show Slave

Application web esclave utilisée par les spectateurs pour transformer leur téléphone en source lumineuse pendant un spectacle.

L'application affiche les scènes envoyées par une application maître via WebSocket. Elle peut être hébergée comme un simple site statique, notamment avec GitHub Pages.

## Fonctionnement

Après l'ouverture de la page, le spectateur appuie sur **Je rejoins le show**. L'application tente alors de :

- passer en plein écran ;
- empêcher la mise en veille de l'écran ;
- se connecter au serveur WebSocket ;
- synchroniser son horloge avec celle du serveur ;
- recevoir et exécuter les scènes à l'heure prévue ;
- conserver la dernière scène affichée en cas de coupure réseau ;
- se reconnecter automatiquement ;
- resynchroniser l'horloge au retour depuis l'arrière-plan.

Un groupe `A`, `B` ou `C` est attribué aléatoirement au téléphone et conservé dans le stockage local du navigateur. Un groupe peut être imposé par l'URL.

## Structure

```text
Light-Show-Slave/
├── index.html
├── README.md
└── assets/
    ├── firework.webp
    ├── heart.webp
    └── star.webp
```

## Lancement local

L'application doit être servie par un serveur HTTP local. L'ouverture directe du fichier peut empêcher certaines fonctions du navigateur, notamment le plein écran, le Wake Lock ou les connexions sécurisées.

Avec Python :

```bash
python -m http.server 8080
```

Puis ouvrir :

```text
http://localhost:8080/
```

## Configuration

La configuration se fait avec les paramètres de l'URL :

```text
https://<compte>.github.io/<repository>/?ws=wss://<serveur>/ws
```

Paramètres disponibles :

| Paramètre | Description |
| --- | --- |
| `ws` | URL du serveur WebSocket maître |
| `group` | Force le groupe du téléphone : `A`, `B` ou `C` |

Exemple :

```text
https://exemple.github.io/Light-Show-Slave/?ws=wss://show.example.com/ws&group=B
```

En production, la page doit être servie en HTTPS et l'URL WebSocket doit utiliser `wss://`.

## Scènes disponibles

Le serveur maître envoie uniquement le nom d'une scène. Les scènes actuellement connues sont :

- `black`
- `white`
- `red`
- `yellow`
- `blue`
- `magenta`
- `green`
- `orange`
- `sunset`
- `cosmic`
- `red-pulse`
- `blue-breathe`
- `rainbow`
- `firework`
- `star`
- `heart`
- `wave-abc`

Les scènes `firework`, `star` et `heart` utilisent les fichiers présents dans `assets/`.

## Protocole WebSocket minimal

### Message envoyé par l'esclave

À la connexion, l'esclave envoie son groupe :

```json
{
  "type": "hello",
  "group": "A"
}
```

Pour synchroniser l'horloge, il envoie des pings :

```json
{
  "type": "ping",
  "id": "identifiant-unique"
}
```

### Réponse attendue du maître

Le maître doit répondre avec l'heure serveur en millisecondes Unix :

```json
{
  "type": "pong",
  "id": "identifiant-unique",
  "serverTime": 1760000000000
}
```

### Déclencher une scène

Le champ `at` correspond à une date Unix en millisecondes selon l'horloge du serveur :

```json
{
  "type": "cue",
  "scene": "red-pulse",
  "at": 1760000005000,
  "groups": ["A", "B"],
  "fade": 400
}
```

- `scene` est obligatoire ;
- `at` est recommandé pour synchroniser les téléphones ;
- `groups` est optionnel ; s'il est absent, tous les groupes exécutent la scène ;
- `fade` est optionnel et exprimé en millisecondes.

Pour déclencher immédiatement une scène, le maître peut envoyer :

```json
{
  "type": "scene",
  "scene": "blue"
}
```

Pour arrêter le spectacle et revenir au noir :

```json
{
  "type": "stop"
}
```

## GitHub Pages

1. Créer un repository GitHub.
2. Ajouter `index.html`, `README.md` et le dossier `assets/`.
3. Ouvrir **Settings > Pages**.
4. Choisir la branche principale et le dossier `/root`.
5. Attendre la génération de l'URL GitHub Pages.
6. Ajouter l'URL WebSocket du maître dans le QR code distribué au public.

## Limites connues

- Le plein écran et le Wake Lock peuvent être refusés par le navigateur.
- Le comportement varie selon iOS, Android, Safari et Chrome.
- La luminosité du téléphone ne peut pas être contrôlée de manière fiable par une page web.
- L'application ne produit pas encore de spectacle seule : elle attend les commandes de l'application maître.
- Le serveur maître doit valider les messages et gérer l'authentification du spectacle.
- Les scènes non déclarées localement sont ignorées.

## Sécurité

- Utiliser HTTPS et `wss://` en production.
- Ne pas placer de données personnelles dans les messages ou les logs.
- Valider côté serveur les groupes, les scènes et les horaires reçus.
- Utiliser un identifiant ou un jeton de spectacle pour empêcher les connexions non autorisées.
