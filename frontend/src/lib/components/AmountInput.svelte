<script>
  let {
    value = $bindable(''),
    placeholder = '0.00',
    symbol = '',
    max = null,
    formatMax = (v) => v,
  } = $props();

  function useMax() {
    if (max !== null && max !== undefined) value = formatMax(max);
  }
</script>

<div class="amount">
  <input
    type="text"
    inputmode="decimal"
    {placeholder}
    bind:value
  />
  {#if symbol}
    <span class="symbol">{symbol}</span>
  {/if}
  {#if max !== null && max !== undefined}
    <button type="button" class="max" onclick={useMax}>Max</button>
  {/if}
</div>

<style>
  .amount {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 4px 8px;
    background: var(--bg);
  }
  input {
    font: inherit;
    font-family: var(--mono);
    border: none;
    outline: none;
    background: transparent;
    color: var(--text-h);
    width: 140px;
    padding: 4px 0;
  }
  .symbol {
    color: var(--text);
    font-size: 14px;
  }
  .max {
    font: inherit;
    font-size: 12px;
    padding: 2px 6px;
    border: 1px solid var(--accent-border);
    background: var(--accent-bg);
    color: var(--accent);
    border-radius: 4px;
    cursor: pointer;
  }
  .max:hover {
    border-color: var(--accent);
  }
</style>
