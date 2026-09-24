const mode = new URLSearchParams(window.location.search).get("mode") || "locations";
const leaderboardMode = mode === "locations" ? "locations" : mode;
const isEntityMode = mode === "entities";
const state = { locations: [], currentRound: 0, score: 0, answered: false, roundLimit: 0, image: "", answers: [], roundStartedAt: 0 };
const elements = {
  game: document.querySelector("#game-grid"), warning: document.querySelector("#load-warning"), roundStatus: document.querySelector("#round-status"),
  scorePanel: document.querySelector("#score-panel"), roundLabel: document.querySelector("#round-label"), score: document.querySelector("#score"),
  sceneImage: document.querySelector("#scene-image"), questionTitle: document.querySelector("#question-title"), sceneNumber: document.querySelector("#scene-number"),
  answerList: document.querySelector("#answer-list"), result: document.querySelector("#result-card"), resultTitle: document.querySelector("#result-title"),
  resultCopy: document.querySelector("#result-copy"), next: document.querySelector("#next-button"), review: document.querySelector("#review-screen"),
  reviewScore: document.querySelector("#review-score"), reviewCorrect: document.querySelector("#review-correct"), reviewList: document.querySelector("#review-list"),
  leaderboardSubmit: document.querySelector("#leaderboard-submit"), playerName: document.querySelector("#player-name"),
  viewer: document.querySelector("#image-viewer"), viewerImage: document.querySelector("#image-viewer-image"), viewerClose: document.querySelector("#image-viewer-close"),
  modeLabel: document.querySelector("#mode-label"), helperText: document.querySelector("#helper-text"), playAgain: document.querySelector("#play-again")
};

if (isEntityMode) {
  elements.modeLabel.textContent = "Classic Entities";
  elements.questionTitle.textContent = "Which entity is this?";
  elements.helperText.textContent = "Choose the entity that best matches the scene.";
  elements.playAgain.href = "classic.html?mode=entities";
}

function showWarning(message) {
  elements.warning.textContent = message;
  elements.warning.hidden = false;
}

function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function getQuestionLimit() {
  return mode === "all" ? 30 : 20;
}

function validateLocations(locations) {
  if (!Array.isArray(locations) || locations.length === 0) throw new Error("Location config is empty");
  if (!locations.every((location) => location && typeof location.id === "string" && typeof location.question === "string" && Array.isArray(location.answers) && location.answers.length > 0 && typeof location.correctAnswer === "string" && location.answers.includes(location.correctAnswer))) {
    throw new Error("Location config has an invalid entry");
  }
  return locations;
}

async function loadJsonFile(fileName) {
  const response = await fetch(`config/${fileName}`);
  if (!response.ok) throw new Error(`${fileName} could not be loaded`);
  return validateLocations(await response.json());
}

async function loadLocations() {
  try {
    if (mode === "all") {
      const [entities, locations] = await Promise.all([loadJsonFile("entities.json"), loadJsonFile("locations.json")]);
      state.locations = shuffle([...entities, ...locations]).slice(0, getQuestionLimit());
    } else {
      state.locations = shuffle(await loadJsonFile(`${mode}.json`)).slice(0, getQuestionLimit());
    }
    return state.locations.length > 0;
  } catch (error) {
    showWarning("The selected game mode could not be loaded.");
    return false;
  }
}

function renderRound() {
  const location = state.locations[state.currentRound];
  state.answered = false;
  state.roundStartedAt = performance.now();
  elements.roundLabel.textContent = `Round ${state.currentRound + 1} of ${state.roundLimit}`;
  elements.score.textContent = state.score.toLocaleString();
  elements.questionTitle.textContent = location.question;
  elements.sceneNumber.textContent = String(state.currentRound + 1).padStart(2, "0");
  elements.sceneImage.style.backgroundImage = "none";
  state.image = location.image || "";
  if (location.image) {
    const image = new Image();
    image.onload = () => { elements.sceneImage.style.backgroundImage = `url("${location.image}")`; };
    image.onerror = () => showWarning("The image for this question could not be loaded.");
    image.src = location.image;
  }
  elements.answerList.innerHTML = "";
  shuffle(location.answers).forEach((choice, index) => {
    const button = document.createElement("button");
    button.className = "answer-button";
    button.type = "button";
    button.dataset.answer = choice;
    const letter = document.createElement("span");
    letter.className = "answer-letter";
    letter.textContent = String.fromCharCode(65 + index);
    const label = document.createElement("span");
    label.textContent = choice;
    button.append(letter, label);
    button.addEventListener("click", () => selectAnswer(button, location));
    elements.answerList.appendChild(button);
  });
  elements.result.hidden = true;
}

function selectAnswer(button, location) {
  if (state.answered) return;
  state.answered = true;
  const isCorrect = button.dataset.answer === location.correctAnswer;
  const timeSeconds = Math.max(0, (performance.now() - state.roundStartedAt) / 1000);
  const points = isCorrect ? getLocationScore(timeSeconds) : 0;
  state.score += points;
  state.answers.push({ questionId: location.id, question: location.question, selectedAnswer: button.dataset.answer, correctAnswer: location.correctAnswer, isCorrect, points, timeSeconds });
  elements.answerList.querySelectorAll(".answer-button").forEach((option) => {
    option.disabled = true;
    if (option.dataset.answer === location.correctAnswer) option.classList.add("correct");
  });
  button.classList.add(isCorrect ? "selected-correct" : "selected-wrong");
  elements.score.textContent = state.score.toLocaleString();
  elements.resultTitle.textContent = isCorrect ? (timeSeconds <= 1 ? "Lightning fast." : timeSeconds <= 20 ? "Good pace." : "Base points secured.") : "Not quite this time.";
  elements.resultCopy.textContent = isCorrect ? `You answered in ${timeSeconds.toFixed(1)} seconds and earned ${points.toLocaleString()} points.` : `The correct answer was ${location.correctAnswer}. You earned 0 points.`;
  elements.result.hidden = false;
  elements.next.textContent = state.currentRound === state.roundLimit - 1 ? "View review" : "Next location →";
}

function getLocationScore(timeSeconds) {
  const fastestTime = 1;
  const slowestTime = 20;
  const maximumPoints = 5000;
  const basePoints = 1000;
  const progress = Math.max(0, Math.min(1, (slowestTime - timeSeconds) / (slowestTime - fastestTime)));
  return Math.round(basePoints + (maximumPoints - basePoints) * progress);
}

function showReview() {
  const correct = state.answers.filter((answer) => answer.isCorrect).length;
  elements.game.hidden = true;
  elements.result.hidden = true;
  elements.reviewScore.textContent = state.score.toLocaleString();
  elements.reviewCorrect.textContent = `${correct}/${state.answers.length}`;
  elements.reviewList.textContent = "";
  state.answers.forEach((answer, index) => {
    const item = document.createElement("div");
    item.className = `review-item ${answer.isCorrect ? "review-correct" : "review-wrong"}`;
    const number = document.createElement("span");
    number.className = "review-number";
    number.textContent = String(index + 1).padStart(2, "0");
    const details = document.createElement("div");
    const question = document.createElement("strong");
    question.textContent = answer.question;
    const result = document.createElement("span");
    result.textContent = answer.isCorrect ? "Correct" : `Correct answer: ${answer.correctAnswer}`;
    details.append(question, result);
    const points = document.createElement("b");
    points.textContent = `${answer.points > 0 ? "+" : ""}${answer.points}`;
    item.append(number, details, points);
    elements.reviewList.appendChild(item);
  });
  elements.review.hidden = false;
}

async function submitScore(event) {
  event.preventDefault();
  const statusLabel = elements.leaderboardSubmit.querySelector("label");
  const submitButton = elements.leaderboardSubmit.querySelector("button");
  const name = elements.playerName.value.trim();
  if (!name) {
    statusLabel.textContent = "Enter a name before submitting.";
    elements.playerName.reportValidity();
    return;
  }
  if (!isAllowedPlayerName(name)) {
    elements.playerName.setCustomValidity("Please choose a different name.");
    elements.playerName.reportValidity();
    return;
  }
  elements.playerName.setCustomValidity("");
  if (!window.adyGuessrSupabase) {
    statusLabel.textContent = "Leaderboard connection unavailable.";
    return;
  }
  statusLabel.textContent = "Submitting score...";
  submitButton.disabled = true;
  try {
    const { error } = await window.adyGuessrSupabase.functions.invoke("submit-score", {
      body: {
        mode: leaderboardMode,
        playerName: name,
        answers: state.answers.map(({ questionId, selectedAnswer, timeSeconds }) => ({ questionId, selectedAnswer, timeSeconds }))
      }
    });
    statusLabel.textContent = error?.context?.response?.status === 403
    ? "Submissions are unavailable from this network."
    : error?.context?.response?.status === 409
      ? "An entry from this device has already been logged. Use your previously used name."
      : error
      ? "Could not submit score. Try again."
      : "Score submitted to the leaderboard.";
    if (error) submitButton.disabled = false;
  } catch {
    statusLabel.textContent = "Could not submit score. Check your connection and try again.";
    submitButton.disabled = false;
  }
}

async function startGame() {
  if (!await loadLocations()) return;
  state.roundLimit = state.locations.length;
  elements.roundStatus.hidden = false;
  elements.scorePanel.hidden = false;
  renderRound();
}

elements.next.addEventListener("click", () => {
  if (state.currentRound === state.roundLimit - 1) showReview();
  else { state.currentRound += 1; renderRound(); }
});
elements.playerName.addEventListener("input", () => {
  elements.playerName.setCustomValidity(isAllowedPlayerName(elements.playerName.value) ? "" : "Please choose a different name.");
});
elements.leaderboardSubmit.addEventListener("submit", submitScore);
elements.sceneImage.addEventListener("click", () => {
  if (!state.image) return;
  elements.viewerImage.src = state.image;
  elements.viewer.hidden = false;
});
elements.viewerClose.addEventListener("click", () => { elements.viewer.hidden = true; elements.viewerImage.src = ""; });

elements.game.hidden = false;
startGame();
