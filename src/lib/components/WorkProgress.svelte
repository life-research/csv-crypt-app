<script lang="ts">
  import {i18n} from '#lib/i18n/i18n.svelte.ts';

  /** `fraction` goes from 0 to 1. */
  const {fraction, oncancel}: {fraction: number; oncancel: () => void} =
    $props();

  const percent = $derived(Math.round(fraction * 100));
</script>

<div class="flex items-center gap-3">
  <progress
    class="h-2 flex-1"
    max="100"
    value={percent}
    aria-label={i18n.t('progress.label')}
  ></progress>
  <span class="w-12 text-right text-sm text-slate-600 tabular-nums"
    >{percent} %</span
  >
  <button type="button" class="btn-secondary" onclick={oncancel}
    >{i18n.t('action.cancel')}</button
  >
</div>
