<script lang="ts">
  import { onMount } from 'svelte';

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
  let status = 'Trouvez des mots en ligne droite';
  let dictionary: string[] = [];
  let dictionarySet = new Set<string>();
  let inputEl: HTMLInputElement | null = null;

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
    timeLeft = totalSeconds;
    timerId = setInterval(() => {
      timeLeft -= 1;
      if (timeLeft <= 0) {
        timeLeft = 0;
        clearTimer();
        status = 'Temps écoulé !';
      }
    }, 1000);
  };

  const restart = () => {
    buildDictionary();
    buildGrid();
    resetHighlights();
    foundWords = [];
    score = 0;
    inputWord = '';
    status = 'Trouvez des mots en ligne droite';
    highlightIndex = 0;
    startTimer();
    inputEl?.focus();
  };

  const addScore = (word: string) => {
    const length = word.length;
    score += length * length;
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
    if (timeLeft <= 0) return;
    const word = normalizeWord(inputWord.trim());
    inputWord = '';
    if (!word) return;

    if (foundWords.includes(word)) {
      status = `Already found ${word}. Try another.`;
      return;
    }

    if (!dictionarySet.has(word)) {
      status = `${word} n'est pas dans le dictionnaire francais.`;
      return;
    }

    const path = findWordPath(word);
    if (!path) {
      status = `${word} n'est pas présent sur la grille.`;
      return;
    }

    highlightPath(path);
    foundWords = [word, ...foundWords];
    addScore(word);
    status = `Bien joué ! ${word} fait ${word.length} lettres.`;
    inputWord = '';
  };

  const handleKey = (event: KeyboardEvent) => {
    if (event.key === 'Enter') submitWord();
  };

  onMount(() => {
    restart();
    return clearTimer;
  });
</script>

<svelte:head>
  <title>Word Trail</title>
</svelte:head>

<main class="page">
  <section class="hero">
    <div class="headline">
      <h1>Trace de mots</h1>
      <p class="subtitle">Composez des mots en ligne droite. Plus c'est long, plus ça rapporte.</p>
    </div>
    <div class="stats">
      <div class="stat">
        <span class="label">Temps</span>
        <span class="value">{Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}</span>
      </div>
      <div class="stat">
        <span class="label">Score</span>
        <span class="value">{score}</span>
      </div>
      <button class="restart" type="button" on:click={restart}>Recommencer</button>
    </div>
  </section>

  <section class="play">
    <div class="panel">
      <div class="input-row">
        <input
          type="text"
          placeholder="Entrez un mot puis Entrer"
          bind:value={inputWord}
          on:keydown={handleKey}
          disabled={timeLeft <= 0}
          bind:this={inputEl}
        />
        <button type="button" on:click={submitWord} disabled={timeLeft <= 0}>Valider</button>
      </div>
      <p class="status">{status}</p>
      <div class="found">
        <p class="found-title">Mots trouvés</p>
        {#if foundWords.length === 0}
          <p class="empty">Aucun mot pour le moment.</p>
        {:else}
          <div class="chips">
            {#each foundWords as word}
              <span class="chip">{word}</span>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <div class="board">
      {#if timeLeft <= 0}
        <div class="overlay">
          <div class="overlay-card">
            <p class="overlay-title">Temps écoulé</p>
            <p class="overlay-sub">La partie est terminée. Prêt à rejouer ?</p>
            <button type="button" on:click={restart}>Rejouer</button>
          </div>
        </div>
      {/if}
      {#each grid as row}
        {#each row as cell}
          <div
            class="tile"
            class:highlighted={cell.highlight}
            style={cell.highlight ? `background: ${cell.highlight}` : ''}
          >
            {cell.letter}
          </div>
        {/each}
      {/each}
    </div>
  </section>
</main>

<style>
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

  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Rubik:wght@400;600;700&display=swap');

  .page {
    min-height: 100vh;
    padding: 48px clamp(20px, 5vw, 56px) 64px;
    display: flex;
    flex-direction: column;
    gap: 32px;
  }

  .hero {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
  }

  .headline {
    max-width: 520px;
  }

  .kicker {
    text-transform: uppercase;
    letter-spacing: 0.36em;
    font-size: 12px;
    color: #b85042;
    margin: 0 0 12px;
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
    gap: 16px;
    background: rgba(255, 255, 255, 0.8);
    padding: 16px 20px;
    border-radius: 18px;
    box-shadow: 0 16px 30px rgba(22, 34, 54, 0.1);
  }

  .stat {
    display: flex;
    flex-direction: column;
    gap: 4px;
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

  .play {
    display: grid;
    grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
    gap: 24px;
    align-items: start;
    justify-content: center;
    justify-items: start;
  }

  .panel {
    background: rgba(255, 255, 255, 0.95);
    border-radius: 20px;
    padding: 24px;
    box-shadow: 0 18px 36px rgba(16, 24, 39, 0.12);
    display: flex;
    flex-direction: column;
    gap: 20px;
    width: min(360px, 100%);
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

  .board {
    display: grid;
    --board-gap: 2px;
    --board-size: min(72vh, calc(100vw - 32px));
    --cell-size: calc((var(--board-size) - (14 * var(--board-gap))) / 15);
    grid-template-columns: repeat(15, var(--cell-size));
    gap: var(--board-gap);
    padding: 16px;
    width: calc(var(--board-size) + 32px);
    height: calc(var(--board-size) + 32px);
    box-sizing: border-box;
    background: rgba(255, 255, 255, 0.85);
    border-radius: 22px;
    box-shadow: 0 20px 36px rgba(10, 20, 34, 0.12);
    position: relative;
    overflow: hidden;
    justify-self: center;
    margin: 0 auto;
    justify-self: center;
    align-self: start;
    margin-top: -30px;
    margin-bottom: 40px;
    margin-left: 100px;
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
    .play {
      grid-template-columns: 1fr;
    }

    .board {
      --board-size: min(72vh, calc(100vw - 24px));
    }
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
</style>
