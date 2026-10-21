<script lang="ts">
  import {isValidHexKey} from '#lib/crypto/key.ts';
  import {i18n} from '#lib/i18n/i18n.svelte.ts';

  let {
    value = $bindable(''),
    id,
    oninput,
  }: {value: string; id: string; oninput?: () => void} = $props();

  const showError = $derived(value.trim() !== '' && !isValidHexKey(value));
</script>

<label for={id} class="block text-sm font-medium text-slate-700">
  {i18n.t('key.inputLabel')}
</label>
<input
  {id}
  type="text"
  bind:value
  {oninput}
  autocomplete="off"
  spellcheck="false"
  class="mt-1 w-full rounded-md border px-3 py-2 font-mono text-sm {showError
    ? 'border-red-500'
    : 'border-slate-300'}"
  aria-invalid={showError}
  aria-describedby={showError ? `${id}-error` : undefined}
/>
{#if showError}
  <p id="{id}-error" class="mt-1 text-sm text-red-700">
    {i18n.t('key.invalid')}
  </p>
{/if}
