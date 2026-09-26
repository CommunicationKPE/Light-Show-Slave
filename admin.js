import { onAuthStateChanged, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { onValue, ref, set } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";
import { auth, database, isConfigured } from "./firebase-client.js";

const status = document.querySelector("#adminStatus");
const duration = document.querySelector("#duration");
const durationValue = document.querySelector("#durationValue");
const loginForm = document.querySelector("#loginForm");
const messageForm = document.querySelector("#messageForm");
const cuePanel = document.querySelector(".cue-panel");
const adminActions = document.querySelector(".admin-actions");
const deviceCount = document.querySelector("#deviceCount");
const deviceCountRow = document.querySelector(".device-count");
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
let midiAccess = null;

function handleMidiMessage({ data }) {
  const [statusByte, note, velocity] = data;
  const button = midiCueButtons.get(note);
  if ((statusByte & 0xf0) === 0x90 && velocity > 0 && button) {
    button.click();
  }
}

function updateMidiInputs() {
  const inputs = [...midiAccess.inputs.values()].filter((input) => input.state === "connected");
  inputs.forEach((input) => {
    input.onmidimessage = handleMidiMessage;
  });
  midiStatus.textContent = inputs.length
    ? `MIDI prêt : ${inputs.map((input) => input.name).join(", ")} (36 : noir, 37 : Light Blue, 39 : Blue, 41 : Purple, 43 : Pink, 45 : Hot Pink, 47 : rouge, 38 : orange, 40 : jaune, 42 : vert, 44 : green/blue, 46 : Aqua, 48-51 : message).`
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

function updateDuration() {
  durationValue.textContent = `${duration.value} ms`;
}

async function sendCue(color, label = "", message = "") {
  if (!isConfigured || !database || !auth?.currentUser) {
    status.textContent = "Ajoute la configuration Firebase dans firebase-config.js";
    return;
  }

  await set(ref(database, "show/currentCue"), {
    color,
    label,
    message,
    transition: Number(duration.value),
    startedAt: Date.now()
  });
  status.textContent = `Signal envoye : ${label || "attente"}`;
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

if (isConfigured && auth) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      cuePanel.hidden = true;
      adminActions.hidden = true;
      deviceCountRow.hidden = true;
      midiStatus.hidden = true;
      status.textContent = "Connectez-vous avec le compte de la regie.";
      return;
    }
    const token = await user.getIdTokenResult();
    const isAdmin = token.claims.admin === true;
    loginForm.hidden = isAdmin;
    cuePanel.hidden = !isAdmin;
    adminActions.hidden = !isAdmin;
    deviceCountRow.hidden = !isAdmin;
    status.textContent = isAdmin ? "Pret a envoyer un signal." : "Connectez-vous avec le compte de la regie.";
    if (isAdmin) {
      watchParticipants();
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