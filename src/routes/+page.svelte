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

  let debugMode = $state(false);
  let gameId = $state('');
  const totalSeconds = $derived(debugMode ? 20 : 300);

  let grid = $state<Cell[][]>([]);
  let inputWord = $state('');
  let foundWords = $state<string[]>([]);
  let score = $state(0);
  let timeLeft = $state(300);
  let status = $state('Appuyez sur démarrer pour lancer la partie.');
  let started = $state(false);
  let streak = $state(0);
  let feedbackClass = $state('');
  let celebrationClass = $state('');
  let lastPointsEarned = $state(0);
  let comboTimer = $state(0);
  let hasFoundWord = $state(false);
  let highScores = $state<HighScore[]>([]);
  let pendingScore = $state<number | null>(null);
  let playerName = $state('');

  let dictionary: string[] = [];
  let dictionarySet = new Set<string>();
  let inputEl = $state<HTMLInputElement | null>(null);
  let nameEl = $state<HTMLInputElement | null>(null);

  type HighScore = {
    name: string;
    score: number;
  };

  const randomLetter = () => alphabet[Math.floor(Math.random() * alphabet.length)];

  const seed = 42;
  let rngState = seed;
  const seededRandom = () => {
    rngState = (rngState * 1103515245 + 12345) & 0x7fffffff;
    return rngState / 0x7fffffff;
  };
  const seededRandomLetter = () => alphabet[Math.floor(seededRandom() * alphabet.length)];

  const resetSeededRandom = () => {
    rngState = seed;
  };

  const normalizeWord = (word: string) =>
    word
      .normalize('NFD')
      .replace(/[^a-zA-Z]/g, '')
      .toUpperCase();

  const buildDictionary = () => {
    const source = frenchRaw as string[];
    const cleaned = source
      .map(normalizeWord)
      .filter((word) => word.length >= 4 && word.length <= 15);
    let unique = Array.from(new Set(cleaned));
    if (debugMode) {
      unique = unique.sort();
    }
    dictionary = unique;
    dictionarySet = new Set(unique);
  };

  const shuffle = <T,>(items: T[], rng: () => number = Math.random) => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
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
  let timerId: ReturnType<typeof setInterval> | undefined;
  let comboTimerId: ReturnType<typeof setInterval> | undefined;
  let lastWordTime = 0;

  const nextHighlightColor = () => {
    const color = highlightPalette[highlightIndex % highlightPalette.length];
    highlightIndex += 1;
    return color;
  };

  const buildGrid = () => {
    if (debugMode) resetSeededRandom();

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

    const rng = debugMode ? seededRandom : () => Math.random();
    const rngLetter = debugMode ? seededRandomLetter : randomLetter;

    const wordPool = shuffle(dictionary, rng).slice(0, 30);

    for (const word of wordPool) {
      let placed = false;
      for (let attempt = 0; attempt < 200 && !placed; attempt += 1) {
        const [dr, dc] = directions[Math.floor(rng() * directions.length)];
        const maxRow = dr === 1 ? size - word.length : dr === -1 ? word.length - 1 : size - 1;
        const minRow = dr === -1 ? word.length - 1 : 0;
        const maxCol = dc === 1 ? size - word.length : dc === -1 ? word.length - 1 : size - 1;
        const minCol = dc === -1 ? word.length - 1 : 0;

        const startRow = Math.floor(rng() * (maxRow - minRow + 1)) + minRow;
        const startCol = Math.floor(rng() * (maxCol - minCol + 1)) + minCol;

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
        if (!cell.letter) cell.letter = rngLetter();
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

  const restart = async (autoStart = true) => {
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
    streak = 0;
    lastWordTime = 0;
    feedbackClass = '';
    celebrationClass = '';
    comboTimer = 0;
    hasFoundWord = false;
    if (comboTimerId) clearInterval(comboTimerId);

    if (autoStart) {
      try {
        const response = await fetch('/api/highscores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'start' })
        });
        const data = await response.json();
        gameId = data.gameId;
        console.log('Game started with ID:', gameId);
      } catch (error) {
        console.error('Failed to start game:', error);
      }

      started = true;
      startTimer();
      inputEl?.focus();
    } else {
      started = autoStart;
    }
  };

  const startGame = () => {
    restart(true);
  };

  const addScore = (word: string) => {
    const length = word.length;
    const now = Date.now();

    // Combo/streak system - bonus if found within 10 seconds of last word
    if (now - lastWordTime < 10000 && lastWordTime > 0) {
      streak = Math.min(streak + 1, 10);
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
    if (streak >= 2) {
      const bonus = Math.min(streak, 10) * 15;
      wordScore += bonus;
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
    if (target.length < 4) return null;

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

  const loadHighScores = async () => {
    try {
      const response = await fetch('/api/highscores');
      const data = await response.json();
      highScores = Array.isArray(data) ? data : [];
    } catch {
      highScores = [];
    }
  };

  const saveHighScoreOnline = async (name: string, score: number) => {
    try {
      await fetch('/api/highscores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submitScore', gameId, name, foundWords, score })
      });
      await loadHighScores();
    } catch (error) {
      console.error('Failed to save high score:', error);
    }
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

  const submitHighScore = async () => {
    if (pendingScore === null) return;
    const cleaned = playerName
      .normalize('NFD')
      .replace(/[^a-zA-Z]/g, '')
      .toUpperCase()
      .slice(0, 3);
    if (cleaned.length !== 3) return;
    await saveHighScoreOnline(cleaned, pendingScore);
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
  <label class="debug-toggle">
    <input type="checkbox" bind:checked={debugMode} />
    Debug
  </label>
  <section class="layout">
    <aside class="column left">
      <Intro />
      <WordInput
        bind:inputWord
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
        bind:playerName
        bind:nameEl
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
    position: relative;
  }

  .debug-toggle {
    position: absolute;
    top: 12px;
    right: 12px;
    font-size: 12px;
    color: #7b879c;
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    z-index: 10;
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
