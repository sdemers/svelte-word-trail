<script lang="ts">
  let { foundWords }: { foundWords: string[] } = $props();
</script>

<div class="card bg-base-100 shadow-xl">
  <div class="card-body p-4">
    <h3 class="card-title text-base">Mots trouves</h3>
    {#if foundWords.length === 0}
      <p class="empty">Aucun mot pour le moment.</p>
    {:else}
      <div class="chips">
        {#each foundWords as word}
          <span class="chip badge badge-secondary">{word}</span>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
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
</style>
