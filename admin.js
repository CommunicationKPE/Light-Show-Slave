import { onAuthStateChanged, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { ref, set } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";
import { auth, database, isConfigured } from "./firebase-client.js";

const status = document.querySelector("#adminStatus");
const duration = document.querySelector("#duration");
const durationValue = document.querySelector("#durationValue");
const loginForm = document.querySelector("#loginForm");
const cuePanel = document.querySelector(".cue-panel");
const adminActions = document.querySelector(".admin-actions");

function updateDuration() {
  durationValue.textContent = `${duration.value} ms`;
}

async function sendCue(color, label = "") {
  if (!isConfigured || !database || !auth?.currentUser) {
    status.textContent = "Ajoute la configuration Firebase dans firebase-config.js";
    return;
  }

  await set(ref(database, "show/currentCue"), {
    color,
    label,
    transition: Number(duration.value),
    startedAt: Date.now()
  });
  status.textContent = `Signal envoye : ${label || "attente"}`;
}

duration.addEventListener("input", updateDuration);
document.querySelectorAll(".cue").forEach((button) => {
  button.addEventListener("click", () => sendCue(button.dataset.color, button.dataset.label));
});
document.querySelector("#standbyButton").addEventListener("click", () => sendCue("#071619"));

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!isConfigured || !auth) {
    status.textContent = "Firebase n'est pas configure.";
    return;
  }
  const formData = new FormData(loginForm);
  try {
    await signInWithEmailAndPassword(auth, formData.get("email"), formData.get("password"));
  } catch (error) {
    console.error("Firebase authentication failed", error);
    status.textContent = `Connexion refusee (${error.code || "erreur inconnue"}).`;
  }
});

if (isConfigured && auth) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      cuePanel.hidden = true;
      adminActions.hidden = true;
      status.textContent = "Connectez-vous avec le compte de la regie.";
      return;
    }
    const token = await user.getIdTokenResult();
    const isAdmin = token.claims.admin === true;
    loginForm.hidden = isAdmin;
    cuePanel.hidden = !isAdmin;
    adminActions.hidden = !isAdmin;
    status.textContent = isAdmin ? "Pret a envoyer un signal." : "Connectez-vous avec le compte de la regie.";
  });
} else {
  cuePanel.hidden = true;
  adminActions.hidden = true;
  status.textContent = "Firebase n'est pas configure.";
}