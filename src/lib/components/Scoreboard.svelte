<script lang="ts">
  type HighScore = {
    name: string;
    score: number;
  };

  let { highScores }: { highScores: HighScore[] } = $props();
</script>

<div class="scores-card card bg-base-100 shadow-xl">
  <div class="card-body p-6">
    <h2 class="card-title mb-4">Classement</h2>
    <div class="scores-sub mt-3">Top 10 des meilleurs scores</div>
    <div class="scores-table mt-3">
      <div class="scores-row header">
        <span>#</span>
        <span>Nom</span>
        <span>Score</span>
      </div>
      {#each highScores as entry, index}
        <div class="scores-row">
          <span>{index + 1}</span>
          <span>{entry.name}</span>
          <span>{entry.score}</span>
        </div>
      {/each}
      {#if highScores.length === 0}
        <p class="scores-empty">Aucun score pour l'instant.</p>
      {/if}
    </div>
  </div>
</div>

<style>
  .scores-card {
    width: 100%;
  }

  .scores-table {
    display: grid;
    gap: 8px;
  }

  .scores-row {
    display: grid;
    grid-template-columns: 32px 1fr 1fr;
    gap: 8px;
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
</style>
