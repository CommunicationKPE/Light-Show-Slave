const path = require("node:path");
const admin = require("firebase-admin");

const [serviceAccountFile, userId] = process.argv.slice(2);

if (!serviceAccountFile || !userId) {
  console.error("Usage: npm run grant-admin -- service-account-key.json FIREBASE_USER_UID");
  process.exit(1);
}

const serviceAccount = require(path.resolve(serviceAccountFile));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

admin.auth().setCustomUserClaims(userId, { admin: true })
  .then(() => console.log(`Le droit admin a ete attribue a ${userId}.`))
  .catch((error) => {
    console.error("Impossible d'attribuer le droit admin.", error.message);
    process.exitCode = 1;
  });