<script lang="ts">
  let { 
    timeLeft, 
    totalSeconds, 
    score, 
    streak, 
    comboTimer, 
    hasFoundWord,
    lastPointsEarned,
    onRestart 
  }: { 
    timeLeft: number;
    totalSeconds: number;
    score: number;
    streak: number;
    comboTimer: number;
    hasFoundWord: boolean;
    lastPointsEarned: number;
    onRestart: () => void;
  } = $props();

  function getTimerColor() {
    if (timeLeft > totalSeconds * 0.5) return 'progress-success';
    if (timeLeft > totalSeconds * 0.25) return 'progress-warning';
    return 'progress-error';
  }
</script>

<div class="stats card bg-base-100 shadow-xl">
  <div class="card-body p-6 gap-4">
    <div class="flex flex-col items-center gap-1">
      <span class="label">Temps</span>
      <span class="value">{Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}</span>
      <progress 
        class="progress w-56 mt-2 {getTimerColor()}"
        style="background: transparent;"
        value={timeLeft} 
        max={totalSeconds}
      ></progress>
    </div>
    <div class="flex flex-col items-center gap-1 mt-3">
      <span class="label">Score</span>
      <span class="value">{score}</span>
      {#if hasFoundWord}
        <span class="text-sm text-primary font-bold mt-1">Combo: {streak > 0 ? streak : 1}x</span>
        <progress class="progress progress-primary w-32 h-2 mt-1" value={comboTimer} max="100"></progress>
        {#if lastPointsEarned > 0}
          <span class="text-xs text-secondary">+{lastPointsEarned} pts</span>
        {/if}
      {/if}
    </div>
    <div class="flex justify-center">
      <button class="btn btn-secondary mt-2" type="button" onclick={onRestart}>Recommencer</button>
    </div>
  </div>
</div>

<style>
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
</style>
