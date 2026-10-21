<script lang="ts">
  import type {SeparatorChoice} from '#lib/files.ts';
  import {i18n} from '#lib/i18n/i18n.svelte.ts';

  let {
    value = $bindable('auto'),
    id,
    onchange,
  }: {value: SeparatorChoice; id: string; onchange?: () => void} = $props();

  const TAB = '\t';
</script>

<label for={id} class="block text-sm font-medium text-slate-700">
  {i18n.t('separator.label')}
</label>
<select
  {id}
  bind:value
  {onchange}
  class="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
>
  <option value="auto">{i18n.t('separator.auto')}</option>
  <option value=",">{i18n.t('separator.comma')}</option>
  <option value=";">{i18n.t('separator.semicolon')}</option>
  <option value={TAB}>{i18n.t('separator.tab')}</option>
</select>
