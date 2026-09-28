import { signInAnonymously } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { onDisconnect, onValue, ref, set } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";
import { auth, database, isConfigured } from "./firebase-client.js";

const joinButton = document.querySelector("#joinButton");
const welcome = document.querySelector("#welcome");
const waiting = document.querySelector("#waiting");
const stage = document.querySelector("#stage");
const showMessage = document.querySelector("#showMessage");
const connectionStatus = document.querySelector("#connectionStatus");
const connectedLabel = document.querySelector("#connectedLabel");
const retryButton = document.querySelector("#retryButton");
const showClosed = document.querySelector("#showClosed");

function applyCue(cue) {
  const color = cue?.color || "#000000";
  const transition = Number(cue?.transition ?? 350);
  stage.style.setProperty("--cue-color", color);
  stage.style.setProperty("--cue-transition", `${transition}ms`);
  showMessage.textContent = cue?.message || "";
  showMessage.hidden = !cue?.message;
}

async function joinShow() {
  welcome.hidden = true;
  waiting.hidden = false;
  retryButton.hidden = true;
  retryButton.disabled = true;
  stage.style.setProperty("--cue-color", "#000000");
  connectedLabel.hidden = true;
  connectionStatus.textContent = "Connexion au show...";

  if (!isConfigured || !database) {
    connectionStatus.textContent = "Firebase doit encore etre configure par la regie.";
    retryButton.disabled = false;
    retryButton.hidden = false;
    return;
  }

  try {
    const credential = auth?.currentUser ? { user: auth.currentUser } : await signInAnonymously(auth);
    const participantId = credential.user.uid;
    const participantRef = ref(database, `participants/${participantId}`);
    await onDisconnect(participantRef).remove();
    await set(participantRef, { joinedAt: Date.now() });
    connectionStatus.textContent = "";
    connectedLabel.hidden = false;
    onValue(ref(database, "show/currentCue"), (snapshot) => applyCue(snapshot.val()));
  } catch (error) {
    console.error("Participant connection failed", error);
    connectionStatus.textContent = "Connexion impossible. Verifie le reseau puis reessaie.";
    retryButton.disabled = false;
    retryButton.hidden = false;
  }
}

joinButton.addEventListener("click", joinShow);
retryButton.addEventListener("click", joinShow);

if (isConfigured && database) {
  onValue(ref(database, "show/active"), (snapshot) => {
    const isActive = snapshot.val() === true;
    joinButton.hidden = !isActive;
    showClosed.hidden = isActive;
  });
} else {
  joinButton.hidden = false;
}