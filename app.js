import { signInAnonymously } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { onValue, ref, set } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";
import { auth, database, isConfigured } from "./firebase-client.js";

const joinButton = document.querySelector("#joinButton");
const welcome = document.querySelector("#welcome");
const waiting = document.querySelector("#waiting");
const stage = document.querySelector("#stage");
const showLabel = document.querySelector("#showLabel");
const connectionStatus = document.querySelector("#connectionStatus");

function applyCue(cue) {
  const color = cue?.color || "#071619";
  const transition = Number(cue?.transition ?? 350);
  stage.style.setProperty("--cue-color", color);
  stage.style.setProperty("--cue-transition", `${transition}ms`);
  showLabel.textContent = cue?.label || "";
  showLabel.hidden = !cue?.label;
}

async function joinShow() {
  welcome.hidden = true;
  waiting.hidden = false;

  if (!isConfigured || !database) {
    connectionStatus.textContent = "Firebase doit encore etre configure par la regie.";
    return;
  }

  const credential = auth?.currentUser ? { user: auth.currentUser } : await signInAnonymously(auth);
  const participantId = credential.user.uid;
  await set(ref(database, `participants/${participantId}`), { joinedAt: Date.now() });
  connectionStatus.textContent = "";
  onValue(ref(database, "show/currentCue"), (snapshot) => applyCue(snapshot.val()));
}

joinButton.addEventListener("click", () => {
  joinShow().catch(() => {
    connectionStatus.textContent = "Connexion impossible. Reessaie dans un instant.";
  });
});