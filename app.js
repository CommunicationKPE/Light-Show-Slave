import { signInAnonymously } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { onDisconnect, onValue, ref, remove, set } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";
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
const kickedNotice = document.querySelector("#kickedNotice");

let session = null;

async function leaveShow(reason) {
  if (!session) return;
  const { participantRef, stopCue, stopSelf } = session;
  session = null;
  stopCue();
  stopSelf();
  try {
    await onDisconnect(participantRef).cancel();
    await remove(participantRef);
  } catch (error) {
    console.error("Participant cleanup failed", error);
  }
  applyCue(null);
  waiting.hidden = true;
  welcome.hidden = false;
  kickedNotice.textContent = reason;
  kickedNotice.hidden = !reason;
}

function applyCue(cue) {
  const color = cue?.color || "#000000";
  const transition = Number(cue?.transition ?? 350);
  stage.style.setProperty("--cue-color", color);
  stage.style.setProperty("--cue-transition", `${transition}ms`);
  showMessage.textContent = cue?.message || "";
  showMessage.hidden = !cue?.message;
}

async function joinShow() {
  if (session) return;
  kickedNotice.hidden = true;
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
    const stopCue = onValue(ref(database, "show/currentCue"), (snapshot) => applyCue(snapshot.val()));
    // The régie kicks a screen by deleting its participant node.
    const stopSelf = onValue(participantRef, (snapshot) => {
      if (!snapshot.exists()) leaveShow("Tu as été déconnecté par la régie.");
    });
    session = { participantRef, stopCue, stopSelf };
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
    if (!isActive) leaveShow("Le show est terminé. Merci ! Vous pouvez quitter cette page et refermer votre navigateur.");
  });
} else {
  joinButton.hidden = false;
}