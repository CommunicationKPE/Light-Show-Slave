# Light Show Slave

Application statique pour des ecrans de spectateurs synchronises avec Firebase Realtime Database. Elle est directement publiable avec GitHub Pages.

## Mise en route

1. Creez un projet Firebase puis activez **Realtime Database**, **Authentication > Anonymous** et **Authentication > E-mail/Mot de passe**.
2. Copiez la configuration de votre application Web Firebase dans [firebase-config.js](firebase-config.js).
3. Dans Firebase Console, publiez les regles de [database.rules.json](database.rules.json).
4. Deployez la branche contenant ces fichiers avec GitHub Pages.
5. Creez le compte e-mail/mot de passe de la regie, attribuez-lui le claim `admin: true`, puis ouvrez `admin.html`. Partagez l'URL de `index.html` via votre QR code.

## Autoriser la regie

1. Dans Firebase Console, activez **Authentication > Sign-in method > E-mail/Mot de passe** et creez le compte de la regie.
2. Copiez son `UID` dans **Authentication > Users**.
3. Dans **Project settings > Service accounts**, generez une nouvelle cle privee et enregistrez le fichier en local sous `service-account-key.json`. Ce fichier est secret et exclu de Git.
4. Executez `npm install`, puis `npm run grant-admin -- service-account-key.json VOTRE_UID`.
5. Connectez-vous de nouveau dans `admin.html`. Les commandes de couleurs apparaissent lorsque le claim est pris en compte.

## Contrat de donnees

La regie ecrit le signal courant sous `show/currentCue` : couleur, nom, transition et instant d'emission. Les spectateurs ecoutent cette valeur en temps reel.

## Avant le spectacle

Les droits administrateur doivent etre attribues depuis un environnement de confiance utilisant Firebase Admin SDK. Ne rendez jamais l'ecriture de `show/currentCue` publique.