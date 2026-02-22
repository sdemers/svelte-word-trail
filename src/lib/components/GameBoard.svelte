<script lang="ts">
  type Cell = {
    letter: string;
    highlight: string | null;
  };

  let { grid, started }: { grid: Cell[][], started: boolean } = $props();
</script>

<div class="board">
  <div class="board-grid" class:blurred={!started}>
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
</div>

<style>
  .board {
    display: grid;
    --board-gap: 2px;
    --board-height: 75vh;
    --cell-size: calc((var(--board-height) - (14 * var(--board-gap))) / 15);
    grid-template-columns: repeat(15, var(--cell-size));
    gap: var(--board-gap);
    padding: 16px;
    width: calc(var(--cell-size) * 15 + 14 * var(--board-gap) + 32px);
    height: calc(var(--cell-size) * 15 + 14 * var(--board-gap) + 32px);
    box-sizing: border-box;
    background: rgba(255, 255, 255, 0.85);
    border-radius: 22px;
    box-shadow: 0 20px 36px rgba(10, 20, 34, 0.12);
    position: relative;
    overflow: hidden;
    justify-self: center;
    margin: 0 auto;
  }

  .board-grid {
    display: contents;
  }

  .board-grid.blurred {
    filter: blur(6px) saturate(0.9);
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
</style>
