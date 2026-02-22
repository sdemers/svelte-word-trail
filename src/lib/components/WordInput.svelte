<script lang="ts">
  let { 
    inputWord = $bindable(), 
    status,
    feedbackClass,
    celebrationClass,
    started,
    timeLeft,
    onSubmit,
    onKeyDown,
    inputEl = $bindable()
  }: { 
    inputWord: string;
    status: string;
    feedbackClass: string;
    celebrationClass: string;
    started: boolean;
    timeLeft: number;
    onSubmit: () => void;
    onKeyDown: (e: KeyboardEvent) => void;
    inputEl: HTMLInputElement | null;
  } = $props();
</script>

<div class="panel card bg-base-100 shadow-xl">
  <div class="card-body p-6">
    <div class="input-row mt-4">
      <input
        class="input input-bordered w-full transition-all {feedbackClass}"
        class:input-success={feedbackClass === 'success'}
        class:input-error={feedbackClass === 'error'}
        type="text"
        placeholder="Entrez un mot"
        bind:value={inputWord}
        onkeydown={onKeyDown}
        disabled={timeLeft <= 0 || !started}
        bind:this={inputEl}
      />
      <button class="btn btn-primary" type="button" onclick={onSubmit} disabled={timeLeft <= 0 || !started}>Valider</button>
    </div>
    <p class="status p-2 mt-4 {celebrationClass}" class:text-primary={celebrationClass === 'celebration'} class:font-bold={celebrationClass === 'celebration'}>{status}</p>
  </div>
</div>

<style>
  .input-row {
    display: flex;
    gap: 12px;
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

  @media (max-width: 600px) {
    .input-row {
      flex-direction: column;
    }
  }
</style>
