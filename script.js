"use strict";

const DIFFICULTIES = {
  easy: { label: "초급", rows: 9, columns: 9, mines: 10 },
  medium: { label: "중급", rows: 16, columns: 16, mines: 40 },
  hard: { label: "고급", rows: 16, columns: 30, mines: 99 },
};

const boardElement = document.querySelector("#board");
const counterElement = document.querySelector("#mine-counter");
const timerElement = document.querySelector("#timer");
const restartButton = document.querySelector("#restart");
const difficultyButtons = document.querySelectorAll("[data-difficulty]");
const messageElement = document.querySelector("#game-message");
const boardViewport = document.querySelector(".board-viewport");

let difficulty = DIFFICULTIES.easy;
let cells = [];
let gameState = "ready";
let minesPlaced = false;
let revealedSafeCells = 0;
let flaggedCells = 0;
let elapsedSeconds = 0;
let timerId = null;
let pressedButtons = new Set();
let chordTriggered = false;

function formatCounter(value) {
  if (value < 0) {
    return `-${String(Math.abs(value)).padStart(2, "0")}`.slice(-3);
  }
  return String(Math.min(value, 999)).padStart(3, "0");
}

function setMessage(text, state = "") {
  messageElement.textContent = text;
  messageElement.dataset.state = state;
}

function updateCounter() {
  counterElement.value = formatCounter(difficulty.mines - flaggedCells);
  counterElement.textContent = counterElement.value;
}

function updateTimer() {
  timerElement.value = formatCounter(elapsedSeconds);
  timerElement.textContent = timerElement.value;
}

function fitBoard() {
  const columns = difficulty.columns;
  const rows = difficulty.rows;
  const shellStyle = window.getComputedStyle(boardViewport.parentElement);
  const horizontalPadding = Number.parseFloat(shellStyle.paddingLeft) + Number.parseFloat(shellStyle.paddingRight);
  const availableWidth = boardViewport.parentElement.clientWidth - horizontalPadding;
  const availableHeight = window.innerHeight - boardViewport.getBoundingClientRect().top - 68;
  const horizontalCellSize = Math.floor((availableWidth - 16 - 2 * (columns - 1)) / columns);
  const verticalCellSize = Math.floor((availableHeight - 2 * (rows - 1)) / rows);
  const cellSize = Math.max(1, Math.min(32, horizontalCellSize, verticalCellSize));
  boardElement.style.setProperty("--cell-size", `${cellSize}px`);
}

function updateFace(face) {
  restartButton.textContent = face;
  restartButton.setAttribute("aria-label", face === "🙂" ? "새 게임" : "게임 상태");
}

function cellAt(row, column) {
  if (row < 0 || row >= difficulty.rows || column < 0 || column >= difficulty.columns) {
    return null;
  }
  return cells[row * difficulty.columns + column];
}

function neighborsOf(cell) {
  const neighbors = [];
  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
      if (rowOffset === 0 && columnOffset === 0) continue;
      const neighbor = cellAt(cell.row + rowOffset, cell.column + columnOffset);
      if (neighbor) neighbors.push(neighbor);
    }
  }
  return neighbors;
}

function initializeBoard() {
  cells = Array.from({ length: difficulty.rows * difficulty.columns }, (_, index) => ({
    row: Math.floor(index / difficulty.columns),
    column: index % difficulty.columns,
    mine: false,
    adjacentMines: 0,
    revealed: false,
    mark: "",
  }));
  boardElement.replaceChildren();
  boardElement.style.setProperty("--columns", difficulty.columns);
  fitBoard();
  boardElement.setAttribute("aria-rowcount", difficulty.rows);
  boardElement.setAttribute("aria-colcount", difficulty.columns);

  for (const [index, cell] of cells.entries()) {
    const element = document.createElement("button");
    element.type = "button";
    element.className = "cell";
    element.dataset.index = index;
    element.setAttribute("role", "gridcell");
    element.setAttribute("aria-label", `${cell.row + 1}행 ${cell.column + 1}열, 닫힌 칸`);
    boardElement.append(element);
    cell.element = element;
  }

  minesPlaced = false;
  gameState = "ready";
  revealedSafeCells = 0;
  flaggedCells = 0;
  elapsedSeconds = 0;
  pressedButtons.clear();
  chordTriggered = false;
  clearInterval(timerId);
  timerId = null;
  updateCounter();
  updateTimer();
  updateFace("🙂");
  for (const button of difficultyButtons) {
    const selected = button.dataset.difficulty === difficultySelectKey();
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  }
  setMessage(`${difficulty.label} 난이도 · 첫 칸은 안전합니다.`);
}

function difficultySelectKey() {
  return Object.entries(DIFFICULTIES).find(([, settings]) => settings === difficulty)?.[0] ?? "easy";
}

function placeMines(firstCell) {
  const safeCells = new Set([firstCell, ...neighborsOf(firstCell)]);
  const candidates = cells.filter((cell) => !safeCells.has(cell));

  for (let index = 0; index < difficulty.mines; index += 1) {
    const swapIndex = index + Math.floor(Math.random() * (candidates.length - index));
    [candidates[index], candidates[swapIndex]] = [candidates[swapIndex], candidates[index]];
    candidates[index].mine = true;
  }

  for (const cell of cells) {
    cell.adjacentMines = neighborsOf(cell).filter((neighbor) => neighbor.mine).length;
  }
  minesPlaced = true;
}

function startTimer() {
  if (timerId !== null) return;
  timerId = window.setInterval(() => {
    elapsedSeconds = Math.min(elapsedSeconds + 1, 999);
    updateTimer();
    if (elapsedSeconds === 999) {
      clearInterval(timerId);
      timerId = null;
    }
  }, 1000);
}

function renderCell(cell) {
  const element = cell.element;
  element.className = "cell";
  element.textContent = "";

  if (cell.revealed) {
    element.classList.add("revealed");
    if (cell.mine) {
      element.textContent = "💣";
      element.classList.add(cell.hit ? "mine-hit" : "mine-shown");
      element.setAttribute("aria-label", `${cell.row + 1}행 ${cell.column + 1}열, 지뢰`);
      return;
    }
    if (cell.adjacentMines > 0) {
      element.textContent = String(cell.adjacentMines);
      element.classList.add(`number-${cell.adjacentMines}`);
      element.setAttribute("aria-label", `${cell.row + 1}행 ${cell.column + 1}열, 주변 지뢰 ${cell.adjacentMines}개`);
    } else {
      element.setAttribute("aria-label", `${cell.row + 1}행 ${cell.column + 1}열, 빈 칸`);
    }
    return;
  }

  if (gameState === "lost" && cell.mark === "flag" && !cell.mine) {
    element.textContent = "✕";
    element.classList.add("wrong-flag");
  } else if (cell.mark === "flag") {
    element.textContent = "🚩";
    element.classList.add("flagged");
  } else if (cell.mark === "question") {
    element.textContent = "?";
    element.classList.add("questioned");
  }

  const markLabel = cell.mark === "flag" ? "깃발" : cell.mark === "question" ? "물음표" : "닫힌 칸";
  element.setAttribute("aria-label", `${cell.row + 1}행 ${cell.column + 1}열, ${markLabel}`);
}

function revealCell(cell) {
  if (cell.revealed || cell.mark === "flag" || gameState === "won" || gameState === "lost") return;
  if (!minesPlaced) placeMines(cell);
  if (cell.mine) {
    cell.hit = true;
    cell.revealed = true;
    endGame("lost");
    return;
  }

  const queue = [cell];
  const queued = new Set([cell]);
  while (queue.length > 0) {
    const current = queue.shift();
    if (current.revealed || current.mark === "flag" || current.mine) continue;
    current.revealed = true;
    revealedSafeCells += 1;
    renderCell(current);

    if (current.adjacentMines === 0) {
      for (const neighbor of neighborsOf(current)) {
        if (!neighbor.revealed && neighbor.mark !== "flag" && !queued.has(neighbor)) {
          queued.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
  }

  if (revealedSafeCells === cells.length - difficulty.mines) {
    endGame("won");
  } else {
    gameState = "playing";
  }
}

function endGame(result) {
  gameState = result;
  clearInterval(timerId);
  timerId = null;
  if (result === "lost") {
    for (const cell of cells) {
      if (cell.mine) cell.revealed = true;
      renderCell(cell);
    }
    updateFace("😵");
    setMessage("지뢰를 밟았습니다. 다시 도전해 보세요.", "lost");
  } else {
    updateFace("😎");
    setMessage("축하합니다! 모든 안전한 칸을 열었습니다.", "won");
  }
}

function cycleMark(cell) {
  if (cell.revealed || gameState === "won" || gameState === "lost") return;
  if (cell.mark === "") {
    cell.mark = "flag";
    flaggedCells += 1;
  } else if (cell.mark === "flag") {
    cell.mark = "question";
    flaggedCells -= 1;
  } else {
    cell.mark = "";
  }
  renderCell(cell);
  updateCounter();
}

function chord(cell) {
  if (!cell.revealed || cell.adjacentMines === 0 || gameState === "won" || gameState === "lost") return false;
  const neighbors = neighborsOf(cell);
  const flags = neighbors.filter((neighbor) => neighbor.mark === "flag").length;
  if (flags !== cell.adjacentMines) return false;
  for (const neighbor of neighbors) {
    if (neighbor.mark !== "flag" && !neighbor.revealed) revealCell(neighbor);
    if (gameState === "lost" || gameState === "won") break;
  }
  return true;
}

function getCellFromTarget(target) {
  const button = target instanceof Element ? target.closest(".cell") : null;
  if (!button || !boardElement.contains(button)) return null;
  return cells[Number(button.dataset.index)] ?? null;
}

boardElement.addEventListener("click", (event) => {
  if (chordTriggered) {
    chordTriggered = false;
    event.preventDefault();
    return;
  }
  const cell = getCellFromTarget(event.target);
  if (!cell) return;
  if (gameState === "ready" && !cell.revealed && cell.mark !== "flag") startTimer();
  if (gameState === "ready" || gameState === "playing") revealCell(cell);
});

boardElement.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  if (chordTriggered) return;
  const cell = getCellFromTarget(event.target);
  if (cell) cycleMark(cell);
});

boardElement.addEventListener("mousedown", (event) => {
  if (event.button !== 0 && event.button !== 2) return;
  pressedButtons.add(event.button);
  if (event.button === 0 && gameState !== "won" && gameState !== "lost") updateFace("😮");

  if (pressedButtons.has(0) && pressedButtons.has(2)) {
    const cell = getCellFromTarget(event.target);
    if (cell && chord(cell)) chordTriggered = true;
  }
});

document.addEventListener("mouseup", (event) => {
  pressedButtons.delete(event.button);
  if (!pressedButtons.has(0) && gameState !== "won" && gameState !== "lost") updateFace("🙂");
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    pressedButtons.clear();
    if (gameState !== "won" && gameState !== "lost") updateFace("🙂");
  }
});

restartButton.addEventListener("click", initializeBoard);
for (const button of difficultyButtons) {
  button.addEventListener("click", () => {
    difficulty = DIFFICULTIES[button.dataset.difficulty];
    initializeBoard();
  });
}

window.addEventListener("resize", fitBoard);
if ("ResizeObserver" in window) {
  new ResizeObserver(fitBoard).observe(boardViewport);
}

initializeBoard();
