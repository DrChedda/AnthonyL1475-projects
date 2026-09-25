const modeLabels = {
  entities: "Entities",
  locations: "Locations",
  "level-0": "Level-0 Locations"
};

const selectedMode = new URLSearchParams(window.location.search).get("mode");
const leaderboardMode = modeLabels[selectedMode] ? selectedMode : null;
const leaderboardTitle = document.querySelector("#leaderboard-title");
const leaderboardList = document.querySelector("#leaderboard-list");
const leaderboardModeLabel = document.querySelector("#leaderboard-mode");
const modeOptions = document.querySelectorAll(".mode-option:not(.mode-option--disabled)");
let leaderboardRequestId = 0;

async function renderLeaderboard(mode) {
  if (!leaderboardTitle || !leaderboardList) return;
  const requestId = ++leaderboardRequestId;
  if (!mode) {
    leaderboardModeLabel.textContent = "Select a mode";
    leaderboardList.innerHTML = "<div class=\"leaderboard-row\"><span>--</span><strong>Choose a mode to view scores</strong><b>--</b></div>";
    return;
  }
  leaderboardModeLabel.textContent = modeLabels[mode];
  leaderboardList.innerHTML = "<div class=\"leaderboard-row\"><span>--</span><strong>Loading scores...</strong><b>--</b></div>";
  if (!window.adyGuessrSupabase) {
    leaderboardList.innerHTML = "<div class=\"leaderboard-row\"><span>--</span><strong>Leaderboard unavailable</strong><b>--</b></div>";
    return;
  }
  const [{ data: entries, error }, { data: contextResponse }] = await Promise.all([
    window.adyGuessrSupabase
    .from("leaderboard_entries")
    .select("player_name, score")
    .eq("mode", mode)
    .order("score", { ascending: false })
    .limit(10),
    window.adyGuessrSupabase.functions.invoke("submit-score", {
      body: { action: "leaderboard-context", mode }
    })
  ]);
  if (requestId !== leaderboardRequestId) return;
  if (error) {
    leaderboardList.innerHTML = "<div class=\"leaderboard-row\"><span>--</span><strong>Leaderboard unavailable</strong><b>--</b></div>";
    return;
  }
  const context = contextResponse?.context;
  const rows = entries.length ? entries : [{ player_name: "No scores yet", score: "--" }];
  const rowMarkup = rows.slice(0, 10).map((entry, index) => {
    const isPlayer = context?.playerName === entry.player_name;
    return `
      <div class="leaderboard-row ${isPlayer ? "leaderboard-row--highlight" : ""}">
        <span>${String(index + 1).padStart(2, "0")}</span>
        <strong>${escapeHtml(entry.player_name)}</strong>
        <b>${typeof entry.score === "number" ? entry.score.toLocaleString() : entry.score}</b>
      </div>
    `;
  });
  if (context?.rank > 10 && typeof context.score === "number") {
    rowMarkup.push(`
      <div class="leaderboard-row leaderboard-row--highlight">
        <span>${String(context.rank).padStart(2, "0")}</span>
        <strong>${escapeHtml(context.playerName)} (You)</strong>
        <b>${context.score.toLocaleString()}</b>
      </div>
    `);
  }
  leaderboardList.innerHTML = rowMarkup.join("");
}

function escapeHtml(value) {
  const element = document.createElement("span");
  element.textContent = value;
  return element.innerHTML;
}

modeOptions.forEach((option) => {
  const optionMode = option.dataset.mode || (option.href.includes("level-0") ? "level-0" : "locations");
  option.classList.toggle("selected", optionMode === leaderboardMode);
  option.addEventListener("click", (event) => {
    const alreadySelected = option.classList.contains("selected");
    if (!alreadySelected) {
      event.preventDefault();
      modeOptions.forEach((item) => item.classList.remove("selected"));
      option.classList.add("selected");
      renderLeaderboard(optionMode);
    }
  });
});

renderLeaderboard(leaderboardMode);
