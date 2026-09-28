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
const welcomeTitle = document.querySelector("#welcomeTitle");
const welcomeIntro = document.querySelector("#welcomeIntro");
const welcomeNotice = document.querySelector("#welcomeNotice");

let session = null;

async function leaveShow(reason, hideTitle = false) {
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
  // Back to the CSS default (transparent) so the page background shows again.
  stage.style.removeProperty("--cue-color");
  showMessage.textContent = "";
  showMessage.hidden = true;
  waiting.hidden = true;
  welcome.hidden = false;
  kickedNotice.textContent = reason;
  kickedNotice.hidden = !reason;
  welcomeTitle.hidden = hideTitle;
  welcomeIntro.hidden = hideTitle;
  welcomeNotice.hidden = hideTitle;
  if (hideTitle) showClosed.hidden = true;
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
    if (isActive && welcomeTitle.hidden) {
      kickedNotice.hidden = true;
      welcomeTitle.hidden = false;
      welcomeIntro.hidden = false;
      welcomeNotice.hidden = false;
    }
    if (!isActive) leaveShow("Le show est terminé. Merci ! Vous pouvez quitter cette page et refermer votre navigateur.", true);
  });
} else {
  joinButton.hidden = false;
}