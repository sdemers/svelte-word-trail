<script lang="ts">
  import { onMount } from 'svelte';

  import Intro from '$lib/components/Intro.svelte';
  import WordInput from '$lib/components/WordInput.svelte';
  import FoundWords from '$lib/components/FoundWords.svelte';
  import GameBoard from '$lib/components/GameBoard.svelte';
  import GameOverlay from '$lib/components/GameOverlay.svelte';
  import GameStats from '$lib/components/GameStats.svelte';
  import Scoreboard from '$lib/components/Scoreboard.svelte';

  type Cell = {
    letter: string;
    highlight: string | null;
  };

  import frenchRaw from 'an-array-of-french-words/index.json';

  const size = 15;
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const totalSeconds = 300;

  let grid: Cell[][] = [];
  let inputWord = '';
  let foundWords: string[] = [];
  let score = 0;
  let timeLeft = totalSeconds;
  let status = 'Appuyez sur démarrer pour lancer la partie.';
  let dictionary: string[] = [];
  let dictionarySet = new Set<string>();
  let inputEl: HTMLInputElement | null = null;
  let nameEl: HTMLInputElement | null = null;
  let started = false;
  let streak = 0;
  let lastWordTime = 0;
  let feedbackClass = '';
  let celebrationClass = '';
  let lastPointsEarned = 0;
  let comboTimer = 0;
  let comboTimerId: ReturnType<typeof setInterval> | undefined;
  let hasFoundWord = false;

  type HighScore = {
    name: string;
    score: number;
  };

  const highScoreKey = 'word-trail-highscores';
  let highScores: HighScore[] = [];
  let pendingScore: number | null = null;
  let playerName = '';

  let timerId: ReturnType<typeof setInterval> | undefined;

  const randomLetter = () => alphabet[Math.floor(Math.random() * alphabet.length)];

  const normalizeWord = (word: string) =>
    word
      .normalize('NFD')
      .replace(/[^a-zA-Z]/g, '')
      .toUpperCase();

  const buildDictionary = () => {
    const source = frenchRaw as string[];
    const cleaned = source
      .map(normalizeWord)
      .filter((word) => word.length >= 3 && word.length <= 8);
    const unique = Array.from(new Set(cleaned));
    dictionary = unique;
    dictionarySet = new Set(unique);
  };

  const shuffle = <T,>(items: T[]) => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const highlightPalette = [
    '#f8c8dc',
    '#cfe6ff',
    '#d8f3dc',
    '#ffe5b4',
    '#e7d4ff',
    '#ffd6c0',
    '#cfeeea'
  ];

  let highlightIndex = 0;

  const nextHighlightColor = () => {
    const color = highlightPalette[highlightIndex % highlightPalette.length];
    highlightIndex += 1;
    return color;
  };

  const buildGrid = () => {
    const emptyGrid = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => ({ letter: '', highlight: null }))
    );

    const directions: Array<[number, number]> = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1]
    ];

    const wordPool = shuffle(dictionary).slice(0, 30);

    for (const word of wordPool) {
      let placed = false;
      for (let attempt = 0; attempt < 200 && !placed; attempt += 1) {
        const [dr, dc] = directions[Math.floor(Math.random() * directions.length)];
        const maxRow = dr === 1 ? size - word.length : dr === -1 ? word.length - 1 : size - 1;
        const minRow = dr === -1 ? word.length - 1 : 0;
        const maxCol = dc === 1 ? size - word.length : dc === -1 ? word.length - 1 : size - 1;
        const minCol = dc === -1 ? word.length - 1 : 0;

        const startRow = Math.floor(Math.random() * (maxRow - minRow + 1)) + minRow;
        const startCol = Math.floor(Math.random() * (maxCol - minCol + 1)) + minCol;

        let fits = true;
        const positions: Array<[number, number]> = [];

        for (let i = 0; i < word.length; i += 1) {
          const row = startRow + dr * i;
          const col = startCol + dc * i;
          const cell = emptyGrid[row][col];
          if (cell.letter && cell.letter !== word[i]) {
            fits = false;
            break;
          }
          positions.push([row, col]);
        }

        if (!fits) continue;

        for (let i = 0; i < positions.length; i += 1) {
          const [row, col] = positions[i];
          emptyGrid[row][col].letter = word[i];
        }
        placed = true;
      }
    }

    for (const row of emptyGrid) {
      for (const cell of row) {
        if (!cell.letter) cell.letter = randomLetter();
      }
    }

    grid = emptyGrid;
  };

  const resetHighlights = () => {
    for (const row of grid) {
      for (const cell of row) {
        cell.highlight = null;
      }
    }
  };

  const clearTimer = () => {
    if (timerId) {
      clearInterval(timerId);
      timerId = undefined;
    }
  };

  const startTimer = () => {
    clearTimer();
    timerId = setInterval(() => {
      timeLeft -= 1;
      if (timeLeft <= 0) {
        timeLeft = 0;
        clearTimer();
        status = 'Temps écoulé !';
        finishGame();
      }
    }, 1000);
  };

  const restart = (autoStart = true) => {
    buildDictionary();
    buildGrid();
    resetHighlights();
    foundWords = [];
    score = 0;
    inputWord = '';
    status = autoStart ? '' : 'Appuyez sur démarrer pour lancer la partie.';
    highlightIndex = 0;
    pendingScore = null;
    playerName = '';
    timeLeft = totalSeconds;
    clearTimer();
    started = autoStart;
    streak = 0;
    lastWordTime = 0;
    feedbackClass = '';
    celebrationClass = '';
    comboTimer = 0;
    hasFoundWord = false;
    if (comboTimerId) clearInterval(comboTimerId);
    if (autoStart) startTimer();
    inputEl?.focus();
  };

  const startGame = () => {
    restart(true);
  };

  const addScore = (word: string) => {
    const length = word.length;
    const now = Date.now();

    // Combo/streak system - bonus if found within 10 seconds of last word
    if (now - lastWordTime < 10000 && lastWordTime > 0) {
      streak += 1;
    } else {
      streak = 1;
    }
    lastWordTime = now;
    
    // Reset combo timer
    comboTimer = 100;
    if (comboTimerId) clearInterval(comboTimerId);
    comboTimerId = setInterval(() => {
      comboTimer -= 2;
      if (comboTimer <= 0) {
        comboTimer = 0;
        if (comboTimerId) clearInterval(comboTimerId);
      }
    }, 200);

    // Base score: length^2
    let wordScore = length * length;

    // Combo bonus
    if (streak > 1) {
      wordScore += streak * 10;
    }

    // Celebration for 5+ letters
    if (length >= 5) {
      celebrationClass = 'celebration';
      setTimeout(() => celebrationClass = '', 600);
    }

    score += wordScore;
    lastPointsEarned = wordScore;
    hasFoundWord = true;
  };

  const showFeedback = (type: 'success' | 'error') => {
    feedbackClass = type;
    setTimeout(() => feedbackClass = '', 500);
  };

  const highlightPath = (path: Array<[number, number]>) => {
    const color = nextHighlightColor();
    for (const [row, col] of path) {
      grid[row][col].highlight = color;
    }
  };

  const inBounds = (row: number, col: number) =>
    row >= 0 && row < size && col >= 0 && col < size;

  const findWordPath = (word: string) => {
    const target = normalizeWord(word).trim();
    if (target.length < 3) return null;

    const directions = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1]
    ];

    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        if (grid[row][col].letter !== target[0]) continue;

        for (const [dr, dc] of directions) {
          const path: Array<[number, number]> = [[row, col]];
          let r = row;
          let c = col;
          let matched = true;

          for (let i = 1; i < target.length; i += 1) {
            r += dr;
            c += dc;
            if (!inBounds(r, c) || grid[r][c].letter !== target[i]) {
              matched = false;
              break;
            }
            path.push([r, c]);
          }

          if (matched) return path;
        }
      }
    }

    return null;
  };

  const submitWord = () => {
    if (timeLeft <= 0 || !started) return;
    const word = normalizeWord(inputWord.trim());
    inputWord = '';
    if (!word) return;

    if (foundWords.includes(word)) {
      status = `${word} déjà trouvé. Réessayez autre chose.`;
      showFeedback('error');
      return;
    }

    if (!dictionarySet.has(word)) {
      status = `${word} n'est pas dans le dictionnaire.`;
      showFeedback('error');
      return;
    }

    const path = findWordPath(word);
    if (!path) {
      status = `${word} n'est pas présent sur la grille.`;
      showFeedback('error');
      return;
    }

    highlightPath(path);
    foundWords = [word, ...foundWords];
    addScore(word);
    status = `Bien joué ! ${word} fait ${word.length} lettres.`;
    showFeedback('success');
    inputWord = '';
  };

  const handleKey = (event: KeyboardEvent) => {
    if (event.key === 'Enter') submitWord();
  };

  const loadHighScores = () => {
    const stored = localStorage.getItem(highScoreKey);
    if (!stored) {
      highScores = [];
      return;
    }
    try {
      const parsed = JSON.parse(stored) as HighScore[];
      if (Array.isArray(parsed)) {
        highScores = parsed
          .filter((entry) => entry && typeof entry.name === 'string' && typeof entry.score === 'number')
          .sort((a, b) => b.score - a.score)
          .slice(0, 10);
      } else {
        highScores = [];
      }
    } catch {
      highScores = [];
    }
  };

  const saveHighScores = () => {
    localStorage.setItem(highScoreKey, JSON.stringify(highScores.slice(0, 10)));
  };

  const isHighScore = (value: number) => {
    if (highScores.length < 10) return value > 0;
    const lowest = highScores[highScores.length - 1]?.score ?? 0;
    return value > lowest;
  };

  const finishGame = () => {
    if (isHighScore(score)) {
      pendingScore = score;
      playerName = '';
      setTimeout(() => (nameEl as HTMLInputElement | null)?.focus(), 0);
    }
  };

  const submitHighScore = () => {
    if (pendingScore === null) return;
    const cleaned = playerName
      .normalize('NFD')
      .replace(/[^a-zA-Z]/g, '')
      .toUpperCase()
      .slice(0, 3);
    if (cleaned.length !== 3) return;
    highScores = [...highScores, { name: cleaned, score: pendingScore }]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    saveHighScores();
    pendingScore = null;
    playerName = '';
  };

  onMount(() => {
    loadHighScores();
    restart(false);
    return clearTimer;
  });
</script>

<svelte:head>
  <title>Word Trail</title>
</svelte:head>

<main class="page">
  <section class="layout">
    <aside class="column left">
      <Intro />
      <WordInput 
        bind:inputWord
        bind:inputEl
        {status}
        {feedbackClass}
        {celebrationClass}
        {started}
        {timeLeft}
        onSubmit={submitWord}
        onKeyDown={handleKey}
      />
      <FoundWords {foundWords} />
    </aside>

    <div class="board-wrapper">
      <GameOverlay 
        {started}
        {timeLeft}
        {pendingScore}
        {playerName}
        {nameEl}
        onStart={startGame}
        onRestart={() => restart(true)}
        onSubmitHighScore={submitHighScore}
      />
      <GameBoard {grid} {started} />
    </div>

    <aside class="column right">
      <GameStats 
        {timeLeft}
        {totalSeconds}
        {score}
        {streak}
        {comboTimer}
        {hasFoundWord}
        {lastPointsEarned}
        onRestart={() => restart(true)}
      />
      <Scoreboard {highScores} />
    </aside>
  </section>
</main>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Rubik:wght@400;600;700&display=swap');

  :global(body) {
    margin: 0;
    font-family: 'Space Grotesk', 'Segoe UI', sans-serif;
    background:
      radial-gradient(circle at 10% 10%, rgba(255, 230, 200, 0.75), transparent 40%),
      radial-gradient(circle at 80% 15%, rgba(204, 230, 255, 0.8), transparent 45%),
      radial-gradient(circle at 20% 80%, rgba(217, 245, 225, 0.8), transparent 50%),
      radial-gradient(circle at 90% 75%, rgba(255, 214, 229, 0.75), transparent 45%),
      #f5f7fb;
    color: #152237;
  }

  :global(*) {
    box-sizing: border-box;
  }

  .page {
    min-height: 100vh;
    padding: 48px clamp(20px, 5vw, 56px) 64px;
    display: flex;
    flex-direction: column;
    gap: 32px;
  }

  .layout {
    display: grid;
    grid-template-columns: minmax(260px, 340px) minmax(0, 1fr) minmax(260px, 320px);
    gap: 28px;
    align-items: start;
  }

  .column {
    display: grid;
    gap: 48px;
  }

  .intro {
    background: rgba(255, 255, 255, 0.9);
    border-radius: 22px;
    padding: 22px 24px;
    box-shadow: 0 16px 32px rgba(15, 23, 36, 0.12);
    display: grid;
    gap: 24px;
  }

  .kicker {
    text-transform: uppercase;
    letter-spacing: 0.36em;
    font-size: 20px;
    font-weight: bold;
    color: #b85042;
    margin: 0 0 12px;
  }

  .rules {
    display: grid;
    gap: 16px;
    font-size: 14px;
    color: #56627a;
  }

  .rules p {
    margin: 0;
  }

  h1 {
    font-size: clamp(40px, 5vw, 64px);
    margin: 0 0 12px;
  }

  .subtitle {
    margin: 0;
    font-size: 16px;
    color: #435169;
  }

  .stats {
    display: flex;
    align-items: center;
    gap: 32px;
    background: rgba(255, 255, 255, 0.8);
    padding: 24px 28px;
    border-radius: 18px;
    box-shadow: 0 16px 30px rgba(22, 34, 54, 0.1);
  }


  .stat {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
  }


  .label {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.24em;
    color: #7b879c;
  }

  .value {
    font-size: 24px;
    font-weight: 600;
  }

  .restart {
    border: none;
    background: #17263f;
    color: white;
    padding: 10px 18px;
    border-radius: 999px;
    font-weight: 600;
    cursor: pointer;
  }

  .restart:hover {
    background: #0e1a2c;
  }

  .panel {
    background: rgba(255, 255, 255, 0.95);
    border-radius: 20px;
    padding: 24px;
    box-shadow: 0 18px 36px rgba(16, 24, 39, 0.12);
    display: flex;
    flex-direction: column;
    gap: 32px;
  }

  .scores-card {
    width: 100%;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 20px;
    padding: 24px;
    box-shadow: 0 18px 36px rgba(16, 24, 39, 0.12);
    display: grid;
    gap: 24px;
  }

  .scores-card h2 {
    margin: 0;
    font-size: 24px;
  }

  .scores-sub {
    font-size: 15px;
    color: #5a677d;
  }

  .scores-table {
    display: grid;
    gap: 16px;
  }

  .scores-row {
    display: grid;
    grid-template-columns: 32px 1fr 1fr;
    gap: 16px;
    font-size: 18px;
    color: #2b3443;
  }

  .scores-row.header {
    font-weight: 600;
    color: #7b879c;
    text-transform: uppercase;
    font-size: 13px;
    letter-spacing: 0.16em;
  }

  .scores-empty {
    margin: 0;
    font-size: 15px;
    color: #9aa4b2;
  }

  .input-row {
    display: flex;
    gap: 12px;
  }

  input {
    flex: 1;
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid #d4dbe7;
    font-size: 16px;
  }

  input:focus {
    outline: 2px solid #f3a25b;
    border-color: transparent;
  }

  button {
    border: none;
    background: #f3a25b;
    color: #321b0f;
    padding: 12px 18px;
    border-radius: 12px;
    font-weight: 600;
    cursor: pointer;
  }

  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .status {
    margin: 0;
    color: #2f3c52;
  }

  .found-title {
    margin: 0 0 8px;
    font-weight: 600;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .chip {
    background: #f0e1d1;
    color: #7a4a22;
    padding: 6px 10px;
    border-radius: 999px;
    font-size: 12px;
    letter-spacing: 0.08em;
  }

  .empty {
    margin: 0;
    color: #9aa4b2;
  }

  .overlay {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(circle at top, rgba(255, 198, 172, 0.8), transparent 55%),
      radial-gradient(circle at bottom, rgba(177, 213, 255, 0.8), transparent 55%),
      rgba(249, 247, 242, 0.92);
    display: grid;
    place-items: center;
    z-index: 2;
    color: #1f2a3a;
    backdrop-filter: blur(4px);
  }

  .overlay-card {
    display: grid;
    gap: 12px;
    padding: 24px 28px;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 20px;
    box-shadow: 0 18px 36px rgba(18, 28, 45, 0.2);
    text-align: center;
  }

  .overlay-title {
    margin: 0;
    font-size: 26px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #c1463f;
  }

  .overlay-sub {
    margin: 0;
    font-size: 14px;
    color: #3c4a5f;
  }

  .overlay button {
    background: #17263f;
    color: white;
  }

  .name-entry {
    display: grid;
    gap: 10px;
  }

  .name-label {
    margin: 0;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: #7b879c;
  }

  .name-row {
    display: flex;
    gap: 10px;
  }

  .name-row input {
    width: 80px;
    text-align: center;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.2em;
  }

  .tile {
    aspect-ratio: 1;
    display: grid;
    place-items: center;
    font-family: 'Rubik', 'Segoe UI', sans-serif;
    font-size: clamp(12px, 1.6vw, 16px);
    font-weight: 700;
    color: #203148;
    background: #edf1f6;
    border-radius: 6px;
    transition: transform 0.2s ease, background 0.2s ease;
  }

  .tile.highlighted {
    transform: scale(1.08);
  }

  @media (max-width: 900px) {
    .layout {
      grid-template-columns: 1fr;
    }

    .board-wrapper {
      order: 2;
    }

    .column.left {
      order: 1;
    }

    .column.right {
      order: 3;
    }
  }

  .card-body {
    padding: 1rem !important;
  }

  .overlay-title {
    margin-bottom: 0.75rem;
  }

  .overlay-sub {
    margin-bottom: 0.75rem;
  }

  .name-entry {
    margin-bottom: 0.75rem;
  }

  .name-entry input {
    margin-bottom: 0.25rem;
  }

  @media (max-width: 600px) {
    .page {
      padding: 32px 16px 48px;
    }

    .stats {
      width: 100%;
      justify-content: space-between;
      flex-wrap: wrap;
    }

    .input-row {
      flex-direction: column;
    }
  }

  .input-success {
    animation: glow-success 0.5s ease-out;
  }

  .input-error {
    animation: shake 0.5s ease-out;
  }

  .celebration {
    animation: celebrate 0.6s ease-out;
  }

  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-8px); }
    40% { transform: translateX(8px); }
    60% { transform: translateX(-6px); }
    80% { transform: translateX(6px); }
  }

  @keyframes glow-success {
    0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
    50% { box-shadow: 0 0 20px 5px rgba(34, 197, 94, 0.5); }
    100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
  }

  @keyframes celebrate {
    0% { transform: scale(1); }
    50% { transform: scale(1.2); }
    100% { transform: scale(1); }
  }
</style>
