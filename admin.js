import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { goOffline, goOnline, onDisconnect, onValue, ref, set } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";
import { auth, database, isConfigured } from "./firebase-client.js";

const status = document.querySelector("#adminStatus");
const logoutButton = document.querySelector("#logoutButton");
const logoutDialog = document.querySelector("#logoutDialog");
const duration = document.querySelector("#duration");
const durationValue = document.querySelector("#durationValue");
const loginForm = document.querySelector("#loginForm");
const messageForm = document.querySelector("#messageForm");
const cuePanel = document.querySelector(".cue-panel");
const adminActions = document.querySelector(".admin-actions");
const deviceCount = document.querySelector("#deviceCount");
const deviceCountRow = document.querySelector(".device-count");
const screenControls = document.querySelector(".screen-controls");
const showToggleButton = document.querySelector("#showToggleButton");
const midiStatus = document.querySelector("#midiStatus");
const midiCueButtons = new Map([
  [36, document.querySelector(".cue.black")],
  [37, document.querySelector(".cue.light-blue")],
  [39, document.querySelector(".cue.blue")],
  [41, document.querySelector(".cue.purple")],
  [43, document.querySelector(".cue.pink")],
  [45, document.querySelector(".cue.hot-pink")],
  [47, document.querySelector(".cue.red")],
  [38, document.querySelector(".cue.orange")],
  [40, document.querySelector(".cue.yellow")],
  [42, document.querySelector(".cue.green")],
  [44, document.querySelector(".cue.green-blue")],
  [46, document.querySelector(".cue.aqua")],
  [48, messageForm.querySelector('button[type="submit"]')],
  [49, messageForm.querySelector('button[type="submit"]')],
  [50, messageForm.querySelector('button[type="submit"]')],
  [51, messageForm.querySelector('button[type="submit"]')]
]);

let stopParticipantsWatch = null;
let stopShowActiveWatch = null;
let showActive = false;
let stopShowPresence = null;
let midiAccess = null;

function startShowPresence() {
  stopShowPresence?.();
  const activeRef = ref(database, "show/active");
  // Re-arm on every (re)connection so the show closes if the régie drops.
  stopShowPresence = onValue(ref(database, ".info/connected"), async (snapshot) => {
    if (snapshot.val() !== true) return;
    await onDisconnect(activeRef).set(false);
    await set(activeRef, true);
  });
}

async function stopShow() {
  stopShowPresence?.();
  stopShowPresence = null;
  const activeRef = ref(database, "show/active");
  await onDisconnect(activeRef).cancel();
  await set(activeRef, false);
  // Also clears stale entries left by screens that went offline.
  await set(ref(database, "participants"), null);
}

function handleMidiMessage({ data }) {
  const [statusByte, note, velocity] = data;
  const button = midiCueButtons.get(note);
  if ((statusByte & 0xf0) === 0x90 && velocity > 0 && button) {
    button.click();
  }
}

function updateMidiInputs() {
  const inputs = [...midiAccess.inputs.values()].filter((input) => input.state === "connected");
  const controllerNames = [...new Set(inputs.map((input) => input.name.match(/\(([^)]+)\)$/)?.[1] || input.name))];
  inputs.forEach((input) => {
    input.onmidimessage = handleMidiMessage;
  });
  midiStatus.textContent = inputs.length
    ? `Contrôleur MIDI connecté : ${controllerNames.join(", ")}.`
    : "Accès MIDI accordé, mais aucun contrôleur n'est détecté.";
}

async function connectMidi() {
  midiStatus.hidden = false;
  if (!navigator.requestMIDIAccess) {
    midiStatus.textContent = "Web MIDI indisponible dans ce navigateur. Essaie Chrome ou Edge sur localhost ou HTTPS.";
    return;
  }

  midiStatus.textContent = "Connexion au contrôleur MIDI...";
  try {
    midiAccess = await navigator.requestMIDIAccess();
    midiAccess.onstatechange = updateMidiInputs;
    updateMidiInputs();
  } catch (error) {
    console.error("MIDI access failed", error);
    midiStatus.textContent = "Accès MIDI refusé. Autorise le MIDI dans les permissions du navigateur.";
  }
}

function watchParticipants() {
  stopParticipantsWatch?.();
  stopParticipantsWatch = onValue(ref(database, "participants"), (snapshot) => {
    deviceCount.textContent = Object.keys(snapshot.val() || {}).length;
  });
}

function watchShowActive() {
  stopShowActiveWatch?.();
  stopShowActiveWatch = onValue(ref(database, "show/active"), (snapshot) => {
    showActive = snapshot.val() === true;
    showToggleButton.textContent = showActive ? "Fermer le show" : "Ouvrir le show";
  });
}

function updateDuration() {
  durationValue.textContent = `${duration.value} ms`;
}

async function sendCue(color, label, message = "") {
  if (!isConfigured || !database || !auth?.currentUser) {
    status.textContent = "Ajoute la configuration Firebase dans firebase-config.js";
    return;
  }

  await set(ref(database, "show/currentCue"), {
    color,
    message,
    transition: Number(duration.value)
  });
  status.textContent = `Signal envoyé : ${label}`;
}

duration.addEventListener("input", updateDuration);
document.querySelectorAll(".cue").forEach((button) => {
  button.addEventListener("click", () => sendCue(button.dataset.color, button.dataset.label));
});
messageForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const message = new FormData(messageForm).get("message").trim();
  if (message) {
    sendCue("#000000", "Message", message);
  }
});

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

logoutButton.addEventListener("click", () => {
  logoutDialog.returnValue = "";
  logoutDialog.showModal();
});

logoutDialog.addEventListener("click", (event) => {
  if (event.target === logoutDialog) logoutDialog.close("cancel");
});

showToggleButton.addEventListener("click", async () => {
  try {
    if (showActive) {
      await stopShow();
      status.textContent = "Show fermé : les écrans ont été déconnectés.";
    } else {
      // Sent before opening so the first screens to join start on black.
      await sendCue("#000000", "Black");
      startShowPresence();
      status.textContent = "Show ouvert : les écrans peuvent se connecter.";
    }
  } catch (error) {
    console.error("Failed to toggle the show", error);
    status.textContent = `Action impossible (${error.code || "erreur inconnue"}).`;
  }
});

logoutDialog.addEventListener("close", async () => {
  if (logoutDialog.returnValue !== "confirm") return;
  // Must run before signOut, while the admin can still write.
  try {
    await stopShow();
  } catch (error) {
    console.error("Failed to close the show", error);
  }
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Firebase sign-out failed", error);
    status.textContent = `Déconnexion impossible (${error.code || "erreur inconnue"}).`;
  }
});

if (isConfigured && auth) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      loginForm.hidden = false;
      loginForm.reset();
      logoutButton.hidden = true;
      cuePanel.hidden = true;
      adminActions.hidden = true;
      deviceCountRow.hidden = true;
      screenControls.hidden = true;
      stopParticipantsWatch?.();
      stopParticipantsWatch = null;
      stopShowActiveWatch?.();
      stopShowActiveWatch = null;
      stopShowPresence?.();
      stopShowPresence = null;
      // Frees the régie's slot among the database's simultaneous connections.
      goOffline(database);
      deviceCount.textContent = "0";
      midiStatus.hidden = true;
      status.textContent = "Connectez-vous avec le compte de la regie.";
      return;
    }
    const token = await user.getIdTokenResult();
    const isAdmin = token.claims.admin === true;
    logoutButton.hidden = false;
    loginForm.hidden = isAdmin;
    cuePanel.hidden = !isAdmin;
    adminActions.hidden = !isAdmin;
    deviceCountRow.hidden = !isAdmin;
    screenControls.hidden = !isAdmin;
    status.textContent = isAdmin ? "Prêt à envoyer un signal..." : "Ce compte n'a pas accès à la régie.";
    if (isAdmin) {
      goOnline(database);
      watchParticipants();
      watchShowActive();
      connectMidi();
    } else {
      stopParticipantsWatch?.();
      deviceCount.textContent = "0";
      midiStatus.hidden = true;
    }
  });
} else {
  cuePanel.hidden = true;
  adminActions.hidden = true;
  deviceCountRow.hidden = true;
  midiStatus.hidden = true;
  status.textContent = "Firebase n'est pas configure.";
}