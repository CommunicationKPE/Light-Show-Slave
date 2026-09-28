import { signInAnonymously } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { goOffline, goOnline, onDisconnect, onValue, ref, remove, set } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";
import { auth, database, isConfigured } from "./firebase-client.js";
import { firebaseConfig } from "./firebase-config.js";

const SHOW_STATUS_POLL_MS = 5000;

const joinButton = document.querySelector("#joinButton");
const welcome = document.querySelector("#welcome");
const waiting = document.querySelector("#waiting");
const stage = document.querySelector("#stage");
const showMessage = document.querySelector("#showMessage");
const connectionStatus = document.querySelector("#connectionStatus");
const connectedLabel = document.querySelector("#connectedLabel");
const retryButton = document.querySelector("#retryButton");
const showClosed = document.querySelector("#showClosed");
const endNotice = document.querySelector("#endNotice");
const welcomeTitle = document.querySelector("#welcomeTitle");
const welcomeIntro = document.querySelector("#welcomeIntro");
const welcomeNotice = document.querySelector("#welcomeNotice");

let session = null;

function setEndScreen(isEnded) {
  endNotice.hidden = !isEnded;
  welcomeTitle.hidden = isEnded;
  welcomeIntro.hidden = isEnded;
  welcomeNotice.hidden = isEnded;
  if (isEnded) {
    showClosed.hidden = true;
    joinButton.hidden = true;
  }
}

function updateWelcome(isActive) {
  joinButton.hidden = !isActive;
  showClosed.hidden = isActive || !endNotice.hidden;
  if (isActive) setEndScreen(false);
}

// Short REST read: doesn't hold one of the database's limited simultaneous connections.
async function pollShowStatus() {
  if (!session) {
    try {
      const response = await fetch(`${firebaseConfig.databaseURL}/show/active.json`);
      if (response.ok) updateWelcome((await response.json()) === true);
    } catch (error) {
      console.error("Show status check failed", error);
    }
  }
  setTimeout(pollShowStatus, SHOW_STATUS_POLL_MS);
}

async function leaveShow() {
  if (!session) return;
  const { participantRef, stopCue, stopConnection, stopActive } = session;
  session = null;
  stopCue();
  stopConnection();
  stopActive();
  try {
    await onDisconnect(participantRef).cancel();
    await remove(participantRef);
  } catch (error) {
    console.error("Participant cleanup failed", error);
  }
  goOffline(database);
  // Back to the CSS default (transparent) so the page background shows again.
  stage.style.removeProperty("--cue-color");
  showMessage.textContent = "";
  showMessage.hidden = true;
  waiting.hidden = true;
  welcome.hidden = false;
  setEndScreen(true);
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
    goOnline(database);
    const credential = auth?.currentUser ? { user: auth.currentUser } : await signInAnonymously(auth);
    const participantId = credential.user.uid;
    const participantRef = ref(database, `participants/${participantId}`);
    await onDisconnect(participantRef).remove();
    await set(participantRef, { joinedAt: Date.now() });
    connectionStatus.textContent = "";
    connectedLabel.hidden = false;
    const stopCue = onValue(ref(database, "show/currentCue"), (snapshot) => applyCue(snapshot.val()));
    const stopConnection = onValue(ref(database, ".info/connected"), async (snapshot) => {
      const isConnected = snapshot.val() === true;
      connectedLabel.textContent = isConnected ? "CONNECTÉ AU SHOW" : "RECONNEXION…";
      if (!isConnected) return;
      // The server removed this screen when the connection dropped: register it again.
      try {
        await onDisconnect(participantRef).remove();
        await set(participantRef, { joinedAt: Date.now() });
      } catch (error) {
        console.error("Participant re-registration failed", error);
      }
    });
    session = { participantRef, stopCue, stopConnection, stopActive: () => {} };
    session.stopActive = onValue(ref(database, "show/active"), (snapshot) => {
      if (snapshot.val() !== true) leaveShow();
    });
  } catch (error) {
    console.error("Participant connection failed", error);
    goOffline(database);
    connectionStatus.textContent = "Connexion impossible. Verifie le reseau puis reessaie.";
    retryButton.disabled = false;
    retryButton.hidden = false;
  }
}

joinButton.addEventListener("click", joinShow);
retryButton.addEventListener("click", joinShow);

if (isConfigured && database) {
  pollShowStatus();
} else {
  joinButton.hidden = false;
}