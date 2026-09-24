const blockedNameFragments = [
  ["n", "i", "g", "g", "e", "r"].join(""),
  ["n", "i", "g", "g", "a"].join("")
];

function normalizePlayerName(name) {
  return name
    .toLowerCase()
    .replace(/[47]/g, "a")
    .replace(/[013]/g, (character) => ({ "0": "o", "1": "i", "3": "e" })[character])
    .replace(/[^a-z0-9]/g, "");
}

function isAllowedPlayerName(name) {
  const normalizedName = normalizePlayerName(name);
  return normalizedName.length > 0 && !blockedNameFragments.some((fragment) => normalizedName.includes(fragment));
}