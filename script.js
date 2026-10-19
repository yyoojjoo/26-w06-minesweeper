const BOARD_SIZE = 9;
const MINE_COUNT = 10;

const boardElement = document.querySelector("#board");
const mineCountElement = document.querySelector("#mine-count");
const timerElement = document.querySelector("#timer");
const restartButton = document.querySelector("#restart-button");
const messageElement = document.querySelector("#game-message");

let cells = [];
let flagsPlaced = 0;
let revealedCount = 0;
let elapsedSeconds = 0;
let timerInterval = null;
let hasStarted = false;
let gameOver = false;

function createBoard() {
  cells = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => ({
    index,
    mine: false,
    adjacentMines: 0,
    revealed: false,
    flagged: false,
    element: null,
  }));
}

function placeMines(safeIndex) {
  const availableCells = cells.filter((cell) => cell.index !== safeIndex);

  for (let index = 0; index < MINE_COUNT; index += 1) {
    const randomIndex = Math.floor(Math.random() * availableCells.length);
    const [mineCell] = availableCells.splice(randomIndex, 1);
    mineCell.mine = true;
  }

  for (const cell of cells) {
    if (!cell.mine) {
      cell.adjacentMines = getNeighbors(cell.index).filter(
        (neighbor) => neighbor.mine,
      ).length;
    }
  }
}

function getNeighbors(index) {
  const row = Math.floor(index / BOARD_SIZE);
  const column = index % BOARD_SIZE;
  const neighbors = [];

  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
      if (rowOffset === 0 && columnOffset === 0) {
        continue;
      }

      const neighborRow = row + rowOffset;
      const neighborColumn = column + columnOffset;

      if (
        neighborRow >= 0 &&
        neighborRow < BOARD_SIZE &&
        neighborColumn >= 0 &&
        neighborColumn < BOARD_SIZE
      ) {
        neighbors.push(cells[neighborRow * BOARD_SIZE + neighborColumn]);
      }
    }
  }

  return neighbors;
}

function startTimer() {
  if (timerInterval !== null) {
    return;
  }

  timerInterval = window.setInterval(() => {
    elapsedSeconds += 1;
    timerElement.textContent = String(elapsedSeconds).padStart(3, "0");
  }, 1000);
}

function stopTimer() {
  if (timerInterval !== null) {
    window.clearInterval(timerInterval);
    timerInterval = null;
  }
}

function renderCell(cell) {
  const button = cell.element;
  button.className = "cell";
  button.removeAttribute("data-neighbors");
  button.textContent = "";

  if (cell.flagged) {
    button.classList.add("flagged");
    button.textContent = "🚩";
    button.setAttribute("aria-label", `${cell.index + 1}번 칸, 깃발 표시`);
  } else if (cell.revealed) {
    button.classList.add("revealed");

    if (cell.mine) {
      button.classList.add("mine");
      button.textContent = "💣";
      button.setAttribute("aria-label", `${cell.index + 1}번 칸, 지뢰`);
    } else if (cell.adjacentMines > 0) {
      button.dataset.neighbors = String(cell.adjacentMines);
      button.textContent = String(cell.adjacentMines);
      button.setAttribute(
        "aria-label",
        `${cell.index + 1}번 칸, 주변 지뢰 ${cell.adjacentMines}개`,
      );
    } else {
      button.setAttribute("aria-label", `${cell.index + 1}번 칸, 빈 칸`);
    }
  } else {
    button.setAttribute("aria-label", `${cell.index + 1}번 칸, 닫힘`);
  }
}

function revealCell(cell) {
  if (cell.revealed || cell.flagged || gameOver) {
    return;
  }

  if (!hasStarted) {
    placeMines(cell.index);
    hasStarted = true;
    startTimer();
  }

  if (cell.mine) {
    cell.revealed = true;
    renderCell(cell);
    cell.element.classList.add("exploded");
    finishGame(false);
    return;
  }

  const cellsToReveal = [cell];

  while (cellsToReveal.length > 0) {
    const nextCell = cellsToReveal.pop();

    if (nextCell.revealed || nextCell.flagged || nextCell.mine) {
      continue;
    }

    nextCell.revealed = true;
    revealedCount += 1;
    renderCell(nextCell);

    if (nextCell.adjacentMines === 0) {
      cellsToReveal.push(
        ...getNeighbors(nextCell.index).filter(
          (neighbor) => !neighbor.revealed && !neighbor.flagged,
        ),
      );
    }
  }

  if (revealedCount === cells.length - MINE_COUNT) {
    finishGame(true);
  }
}

function toggleFlag(cell) {
  if (gameOver || cell.revealed) {
    return;
  }

  if (!cell.flagged && flagsPlaced >= MINE_COUNT) {
    messageElement.textContent = "깃발은 최대 10개까지 꽂을 수 있어요.";
    return;
  }

  cell.flagged = !cell.flagged;
  flagsPlaced += cell.flagged ? 1 : -1;
  mineCountElement.textContent = String(MINE_COUNT - flagsPlaced);
  renderCell(cell);
  messageElement.textContent = "왼쪽 클릭으로 칸을 열고, 오른쪽 클릭으로 깃발을 꽂으세요.";
}

function finishGame(won) {
  gameOver = true;
  stopTimer();

  if (won) {
    restartButton.textContent = "😎";
    messageElement.textContent = "축하합니다! 모든 안전한 칸을 열었어요.";
    messageElement.dataset.state = "won";
  } else {
    restartButton.textContent = "😵";
    messageElement.textContent = "지뢰를 밟았어요! 새 게임으로 다시 도전하세요.";
    messageElement.dataset.state = "lost";

    for (const cell of cells) {
      if (cell.mine && !cell.revealed) {
        cell.revealed = true;
        renderCell(cell);
      }
    }
  }

  for (const cell of cells) {
    cell.element.disabled = true;
  }
}

function startNewGame() {
  stopTimer();
  flagsPlaced = 0;
  revealedCount = 0;
  elapsedSeconds = 0;
  hasStarted = false;
  gameOver = false;
  mineCountElement.textContent = String(MINE_COUNT);
  timerElement.textContent = "000";
  restartButton.textContent = "🙂";
  messageElement.textContent =
    "왼쪽 클릭으로 칸을 열고, 오른쪽 클릭으로 깃발을 꽂으세요.";
  delete messageElement.dataset.state;
  createBoard();
  boardElement.replaceChildren();

  for (const cell of cells) {
    const button = document.createElement("button");
    button.className = "cell";
    button.type = "button";
    button.setAttribute("role", "gridcell");
    button.addEventListener("click", () => revealCell(cell));
    button.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      toggleFlag(cell);
    });
    button.addEventListener("keydown", (event) => {
      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        toggleFlag(cell);
      }
    });
    cell.element = button;
    renderCell(cell);
    boardElement.append(button);
  }
}

restartButton.addEventListener("click", startNewGame);
startNewGame();
