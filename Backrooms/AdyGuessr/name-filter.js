import { containsProfanity } from "./node_modules/better-profane-words/index.js";

function normalizePlayerName(name) {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[47]/g, "a")
    .replace(/[013]/g, (character) => ({ "0": "o", "1": "i", "3": "e" })[character])
    .replace(/[^a-z0-9]/g, "");
}

function isAllowedPlayerName(name) {
  const value = String(name ?? "").trim();
  const normalized = normalizePlayerName(value);

  if (!value || !normalized) {
    return false;
  }

  return !(containsProfanity(value) || containsProfanity(normalized));
}

globalThis.normalizePlayerName = normalizePlayerName;
globalThis.isAllowedPlayerName = isAllowedPlayerName;