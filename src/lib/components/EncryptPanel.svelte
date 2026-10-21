<script lang="ts">
  import {generateHexKey, isValidHexKey} from '#lib/crypto/key.ts';
  import {
    encryptFile,
    type FileResult,
    type SeparatorChoice,
  } from '#lib/files.ts';
  import {i18n} from '#lib/i18n/i18n.svelte.ts';
  import {inputSummary, unexpectedErrorMessage} from '#lib/messages.ts';
  import {outputFileName, saveFile} from '#lib/save.ts';
  import FilePicker from './FilePicker.svelte';
  import KeyDisplay from './KeyDisplay.svelte';
  import KeyInput from './KeyInput.svelte';
  import SeparatorSelect from './SeparatorSelect.svelte';
  import StatusMessage from './StatusMessage.svelte';

  interface Encrypted extends FileResult {
    hexKey: string;
  }

  let file = $state<File | null>(null);
  let separator = $state<SeparatorChoice>('auto');
  let useOwnKey = $state(false);
  let ownKey = $state('');
  let working = $state(false);
  let result = $state<Encrypted | null>(null);
  let error = $state('');
  let saved = $state(false);

  const canStart = $derived(
    file !== null && !working && (!useOwnKey || isValidHexKey(ownKey)),
  );

  function selectFile(selected: File) {
    clearResult();
    file = selected;
  }

  async function encrypt() {
    if (!file) {
      return;
    }
    clearResult();
    working = true;
    try {
      const hexKey = useOwnKey ? ownKey.trim().toLowerCase() : generateHexKey();
      const input = new Uint8Array(await file.arrayBuffer());
      result = {...(await encryptFile(input, hexKey, {separator})), hexKey};
    } catch (caught) {
      error = unexpectedErrorMessage(i18n.t, caught);
    } finally {
      working = false;
    }
  }

  async function save() {
    if (result && file) {
      const name = outputFileName(file.name, 'crypt');
      saved = (await saveFile(result.output, name, 'text/csv')) === 'saved';
    }
  }

  function clearResult() {
    result = null;
    error = '';
    saved = false;
  }

  // Drops all references to data and key; the browser frees the memory later.
  function reset() {
    clearResult();
    file = null;
    ownKey = '';
    useOwnKey = false;
    separator = 'auto';
  }
</script>

<div class="space-y-5">
  <FilePicker id="encrypt-file" {file} onselect={selectFile} />

  <div>
    <SeparatorSelect
      id="encrypt-separator"
      bind:value={separator}
      onchange={clearResult}
    />
  </div>

  <div>
    <label class="flex items-center gap-2 text-sm">
      <input type="checkbox" bind:checked={useOwnKey} />
      {i18n.t('encrypt.ownKey')}
    </label>
    <p class="mt-1 text-xs text-slate-500">{i18n.t('encrypt.ownKeyHint')}</p>
    {#if useOwnKey}
      <div class="mt-2"><KeyInput id="encrypt-key" bind:value={ownKey} /></div>
    {/if}
  </div>

  <button
    type="button"
    class="btn-primary"
    disabled={!canStart}
    onclick={encrypt}
  >
    {working ? i18n.t('action.working') : i18n.t('encrypt.start')}
  </button>

  {#if error}
    <StatusMessage kind="error" text={error} />
  {/if}

  {#if result && file}
    <div class="space-y-4 border-t border-slate-200 pt-5">
      <StatusMessage
        kind="success"
        text="{i18n.t('encrypt.done')} {inputSummary(i18n.t, result.input)}"
      />
      <KeyDisplay
        hexKey={result.hexKey}
        fileName={outputFileName(file.name, 'key', 'txt')}
      />
      <div class="flex flex-wrap items-center gap-3">
        <button type="button" class="btn-primary" onclick={save}
          >{i18n.t('encrypt.save')}</button
        >
        <button type="button" class="btn-secondary" onclick={reset}
          >{i18n.t('action.reset')}</button
        >
        {#if saved}<span class="text-sm text-green-800" role="status"
            >{i18n.t('action.saved')}</span
          >{/if}
      </div>
    </div>
  {/if}
</div>
