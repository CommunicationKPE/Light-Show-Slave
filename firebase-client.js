import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const isConfigured = !Object.values(firebaseConfig).some((value) => value.startsWith("REPLACE_"));
const app = isConfigured ? initializeApp(firebaseConfig) : null;

export const database = app ? getDatabase(app) : null;
export const auth = app ? getAuth(app) : null;
export { isConfigured };