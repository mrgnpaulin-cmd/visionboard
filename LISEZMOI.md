# SO/CO — application de pilotage

Application web installable sur **Mac** et **iPhone**. Même code, même icône, même
données locales sur chaque appareil. Aucun serveur, aucun compte, aucun abonnement.

Elle contient les quatre posters du système mural, et **régénère les PDF A3 remplis
avec tes données** quand tu veux réimprimer.

---

## 1. Mettre l'app en ligne (obligatoire, 5 minutes)

Une application installable **exige une adresse en HTTPS**. Ouvrir `index.html` par
double-clic affiche bien l'interface, mais l'app ne pourra ni s'installer, ni
fonctionner hors ligne. Il faut donc l'héberger. C'est gratuit et définitif.

### Option A — GitHub Pages (recommandée, gratuite, permanente)

1. Crée un dépôt **privé ou public** sur github.com, par exemple `soco-app`.
2. Dépose tout le contenu de ce dossier à la racine du dépôt
   (`index.html` doit être à la racine, pas dans un sous-dossier).
3. Dans le dépôt : **Settings → Pages → Source : Deploy from a branch →
   Branch : `main` / `root`** → Save.
4. Attends une minute. GitHub affiche l'adresse :
   `https://<ton-compte>.github.io/soco-app/`

> Un dépôt privé nécessite un compte GitHub payant pour publier des Pages.
> Si tu es en gratuit, mets le dépôt en public : le code ne contient
> **aucune donnée**, seulement l'interface vide. Tes données restent sur tes appareils.

### Option B — Cloudflare Pages ou Netlify

Les deux acceptent un dépôt Git ou un glisser-déposer de dossier, et fournissent
une adresse HTTPS immédiate. Même résultat, compte gratuit requis.

### Option C — Test local seulement

```bash
cd /chemin/vers/soco-app
python3 -m http.server 8000
```

Puis `http://localhost:8000` dans Safari. `localhost` est considéré comme sécurisé :
l'installation et le mode hors ligne fonctionnent. Pratique pour essayer,
inutilisable au quotidien puisqu'il faut relancer le serveur à chaque fois.

---

## 2. Installer sur Mac

1. Ouvre l'adresse HTTPS dans **Safari**.
2. Menu **Fichier → Ajouter au Dock…**
3. L'app apparaît dans le Dock et le Launchpad, dans sa propre fenêtre,
   sans barre d'adresse.

Avec Chrome ou Edge : icône **⊕ Installer** dans la barre d'adresse.

Raccourcis clavier disponibles : **⌘S** sauvegarde le fichier, **⌘P** génère les posters.

## 3. Installer sur iPhone

1. Ouvre la même adresse dans **Safari** (pas Chrome — sur iOS, seul Safari sait
   installer une app sur l'écran d'accueil).
2. Bouton **Partager** (carré avec flèche) → **Sur l'écran d'accueil**.
3. Valide. L'icône SO/CO apparaît, l'app s'ouvre en plein écran.

---

## 4. Sauvegarde et transfert entre appareils

**Point important : Mac et iPhone ne se synchronisent pas automatiquement.**
Chaque appareil garde ses propres données. Le fichier de sauvegarde sert
à la fois de filet de sécurité et de moyen de transfert.

### Sauvegarder

Onglet **Réglages → Sauvegarder** (ou ⌘S sur Mac).

- **Sur iPhone** : la feuille de partage s'ouvre → **Enregistrer dans Fichiers →
  iCloud Drive**. Choisis toujours le même dossier.
- **Sur Mac** : le fichier `SOCO_sauvegarde_AAAA-MM-JJ.json` arrive dans
  Téléchargements. Déplace-le dans ton dossier iCloud Drive.

Un bandeau orange apparaît automatiquement dès que la dernière sauvegarde
remonte à plus de 3 jours.

### Restaurer ou transférer

Onglet **Réglages → Restaurer un fichier** → choisis le `.json` dans iCloud Drive.
Les données de l'appareil sont **remplacées** par celles du fichier, après confirmation.

Une routine simple : tu saisis sur l'iPhone dans la journée, tu sauvegardes le soir,
et tu restaures sur le Mac le lundi avant d'imprimer les posters.

---

## 5. Imprimer les posters A3

Bouton **⎙** en haut à droite, ou **Réglages → Imprimer les posters**, ou **⌘P**.

Les quatre posters se génèrent au format A3 (297 × 420 mm), remplis avec les données
du mois affiché. Dans la fenêtre d'impression :

- pour un fichier : menu **PDF → Enregistrer au format PDF** ;
- pour imprimer directement : format papier **A3**, mise à l'échelle **100 %**,
  et coche **Imprimer les arrière-plans** (sinon les aplats noirs et orange ne sortent pas).

Le poster **North** est sur fond noir : il se réimprime rarement, une fois par an.
Les trois autres sont sur fond blanc pour rester annotables au feutre.

---

## 6. Ce que l'app ne fait pas

À lire avant de t'appuyer dessus.

- **Pas de synchronisation automatique** entre Mac et iPhone. Transfert par fichier.
- **Pas de compte, pas de serveur.** Personne ne peut récupérer tes données à ta
  place — si tu effaces les données de Safari ou désinstalles l'app sans sauvegarde,
  tout est perdu. D'où le bandeau de rappel.
- **Pas de facturation, pas de devis, pas de comptabilité.** C'est volontaire :
  ces sujets relèvent de ton outil de facturation, qui porte les obligations légales.
  Les chiffres saisis ici sont un miroir, pas une source de vérité.
- **Pas de notification.** iOS ne les autorise que sous conditions et elles
  n'apportent rien à un rituel du soir de soixante secondes.
- **Polices substituées** : la charte prévoit *Tokio Noir* (titres) et *Helvetica*
  (textes). Ces polices ne sont pas librement redistribuables, l'app utilise
  **Anton** légèrement incliné et **Inter**. Pour rétablir la vraie typo, dépose
  les fichiers dans `fonts/` et modifie les blocs `@font-face` en haut de `app.css`.

---

## 7. Structure des fichiers

```
soco-app/
├── index.html            structure de la page et conteneur d'impression
├── app.css               thème de l'app + feuille de style des posters A3
├── app.js                modèle de données, vues, sauvegarde, génération des posters
├── manifest.webmanifest  nom, icônes et mode d'affichage de l'app installée
├── sw.js                 service worker : cache hors ligne
├── fonts/                Anton + Inter (woff2)
├── icons/                icônes 180 / 192 / 512 / 1024 px
└── assets/logo.png       logo SO/CO détouré
```

Deux endroits à connaître dans `app.js` :

- `ETAPES` (en haut) : les étapes de production des deux pôles. Ajouter, renommer
  ou retirer une étape ici la propage dans l'app **et** dans le poster A3.
- `dataVierge()` : le modèle de données. Les tableaux `contacts` et `catalogue`
  y sont déjà présents mais inutilisés — ils sont réservés à une éventuelle phase 2
  (contacts, catalogue label) et évitent une migration destructive plus tard.

Après toute modification, incrémente `CACHE_VERSION` dans `sw.js`, sinon les
appareils continueront de servir l'ancienne version depuis leur cache.

---

## 8. Mettre à jour l'app

Remplace les fichiers sur ton hébergement, change `CACHE_VERSION` dans `sw.js`,
puis rouvre l'app. Tes données ne sont **jamais** touchées par une mise à jour :
elles vivent dans le stockage du navigateur, pas dans les fichiers de l'app.
Sauvegarde quand même avant, par principe.
