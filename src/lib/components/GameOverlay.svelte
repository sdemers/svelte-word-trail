<script lang="ts">
  let { 
    started, 
    timeLeft, 
    pendingScore,
    playerName = $bindable(),
    nameEl = $bindable(),
    onStart,
    onRestart,
    onSubmitHighScore
  }: { 
    started: boolean;
    timeLeft: number;
    pendingScore: number | null;
    playerName: string;
    nameEl: HTMLInputElement | null;
    onStart: () => void;
    onRestart: () => void;
    onSubmitHighScore: () => void;
  } = $props();
</script>

{#if !started}
  <div class="overlay">
    <div class="overlay-card card bg-base-100 shadow-2xl">
      <div class="card-body items-center text-center p-8">
        <p class="overlay-title text-2xl font-bold mb-4">Pret a jouer ?</p>
        <p class="overlay-sub mb-6">La grille est cachée. Lancez la partie pour commencer.</p>
        <button class="btn btn-primary btn-lg" type="button" onclick={onStart}>Démarrer</button>
      </div>
    </div>
  </div>
{:else if timeLeft <= 0}
  <div class="overlay">
    <div class="overlay-card card bg-base-100 shadow-2xl">
      <div class="card-body items-center text-center p-8">
        <p class="overlay-title text-2xl font-bold mb-4">Temps ecoule</p>
        <p class="overlay-sub mb-6">La partie est terminée. Prêt à rejouer ?</p>
        {#if pendingScore !== null}
          <div class="name-entry mb-4">
            <p class="name-label mb-2">Votre nom (3 lettres)</p>
            <div class="name-row">
              <input
                class="input input-bordered w-20 text-center uppercase"
                type="text"
                maxlength="3"
                bind:value={playerName}
                bind:this={nameEl}
              />
              <button class="btn btn-primary" type="button" onclick={onSubmitHighScore}>Valider</button>
            </div>
          </div>
        {/if}
        <button class="btn btn-primary btn-lg" type="button" onclick={onRestart}>Rejouer</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(circle at top, rgba(255, 198, 172, 0.8), transparent 55%),
      radial-gradient(circle at bottom, rgba(177, 213, 255, 0.8), transparent 55%),
      rgba(249, 247, 242, 0.92);
    display: grid;
    place-items: center;
    z-index: 10;
    color: #1f2a3a;
    backdrop-filter: blur(4px);
    border-radius: 22px;
  }

  .overlay-card {
    max-width: 400px;
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
    justify-content: center;
  }
</style>
