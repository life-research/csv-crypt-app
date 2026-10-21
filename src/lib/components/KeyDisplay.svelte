<script lang="ts">
  import {encodeUtf8} from '#lib/csv/encoding.ts';
  import {i18n} from '#lib/i18n/i18n.svelte.ts';
  import {saveFile} from '#lib/save.ts';

  const {hexKey, fileName}: {hexKey: string; fileName: string} = $props();

  let copied = $state(false);

  async function copy() {
    await navigator.clipboard.writeText(hexKey);
    copied = true;
  }

  async function save() {
    await saveFile(encodeUtf8(hexKey + '\n'), fileName, 'text/plain');
  }
</script>

<div class="rounded-lg border border-amber-300 bg-amber-50 p-4">
  <p class="text-sm font-medium text-slate-700">{i18n.t('key.label')}</p>
  <p
    class="mt-1 rounded bg-white px-3 py-2 font-mono text-sm break-all select-all"
  >
    {hexKey}
  </p>
  <div class="mt-3 flex flex-wrap gap-2">
    <button type="button" class="btn-secondary" onclick={copy}
      >{i18n.t('key.copy')}</button
    >
    <button type="button" class="btn-secondary" onclick={save}
      >{i18n.t('key.save')}</button
    >
  </div>
  {#if copied}
    <p class="mt-2 text-sm text-slate-700" role="status">
      {i18n.t('key.copied')}
    </p>
  {/if}
  <p class="mt-3 text-sm font-medium text-amber-900">{i18n.t('key.warning')}</p>
</div>
