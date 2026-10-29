<script lang="ts">
  import {ACCEPT} from '#lib/file-names.ts';
  import {i18n} from '#lib/i18n/i18n.svelte.ts';
  import {rejectedFileMessage} from '#lib/messages.ts';
  import StatusMessage from './StatusMessage.svelte';

  const {
    file,
    id,
    onselect,
  }: {file: File | null; id: string; onselect: (file: File) => void} = $props();

  let dragging = $state(false);
  // A rejected file keeps the previous selection.
  let rejectedName = $state('');
  // Derived, so that the message follows a change of the language.
  const rejection = $derived(
    rejectedName ? rejectedFileMessage(i18n.t, rejectedName) : null,
  );

  function select(selected: File) {
    const rejected = rejectedFileMessage(i18n.t, selected.name) !== null;
    rejectedName = rejected ? selected.name : '';
    if (!rejected) {
      onselect(selected);
    }
  }

  function onChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const selected = input.files?.[0];
    // Allows to select the same file again after a reset.
    input.value = '';
    if (selected) {
      select(selected);
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    dragging = false;
    const dropped = event.dataTransfer?.files[0];
    if (dropped) {
      select(dropped);
    }
  }
</script>

<label
  for={id}
  class="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors {dragging
    ? 'border-blue-500 bg-blue-50'
    : 'border-slate-300 hover:border-slate-400'}"
  ondragover={(event) => {
    event.preventDefault();
    dragging = true;
  }}
  ondragleave={() => (dragging = false)}
  ondrop={onDrop}
>
  {#if file}
    <span class="font-medium break-all"
      >{i18n.t('file.selected', {name: file.name})}</span
    >
    <span class="mt-1 text-sm text-slate-500">{i18n.t('file.change')}</span>
  {:else}
    <span class="text-slate-600">{i18n.t('file.drop')}</span>
  {/if}
  <input {id} type="file" accept={ACCEPT} class="sr-only" onchange={onChange} />
</label>

{#if rejection}
  <div class="mt-2"><StatusMessage kind="error" text={rejection} /></div>
{/if}
