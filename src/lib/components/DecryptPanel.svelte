<script lang="ts">
  import {isValidHexKey} from '#lib/crypto/key.ts';
  import {
    decryptFile,
    OUTPUT_TYPES,
    type FileResult,
    type OutputFormat,
    type SeparatorChoice,
  } from '#lib/files.ts';
  import {i18n} from '#lib/i18n/i18n.svelte.ts';
  import {
    decryptErrorMessage,
    inputSummary,
    unexpectedErrorMessage,
  } from '#lib/messages.ts';
  import {outputFileName, saveFile} from '#lib/save.ts';
  import {isExcelFileName} from '#lib/xlsx/kind.ts';
  import FilePicker from './FilePicker.svelte';
  import KeyInput from './KeyInput.svelte';
  import SeparatorSelect from './SeparatorSelect.svelte';
  import StatusMessage from './StatusMessage.svelte';

  let file = $state<File | null>(null);
  let hexKey = $state('');
  let separator = $state<SeparatorChoice>('auto');
  let outputFormat = $state<OutputFormat>('excel');
  let working = $state(false);
  let result = $state<FileResult | null>(null);
  let error = $state('');
  let saved = $state(false);

  const isExcel = $derived(file !== null && isExcelFileName(file.name));
  const canStart = $derived(file !== null && !working && isValidHexKey(hexKey));

  function selectFile(selected: File) {
    clearResult();
    file = selected;
  }

  async function decrypt() {
    if (!file) {
      return;
    }
    clearResult();
    working = true;
    try {
      const input = new Uint8Array(await file.arrayBuffer());
      const decrypted = await decryptFile(input, hexKey, {
        separator,
        outputFormat,
      });
      if (decrypted.ok) {
        result = decrypted;
      } else {
        error = decryptErrorMessage(
          i18n.t,
          decrypted.lineNumber,
          decrypted.error,
          decrypted.sheet,
        );
      }
    } catch (caught) {
      error = unexpectedErrorMessage(i18n.t, caught);
    } finally {
      working = false;
    }
  }

  async function save() {
    if (result && file) {
      const {extension, mimeType} = OUTPUT_TYPES[result.input.kind];
      const name = outputFileName(
        file.name.replace(/_crypt(\.[^.]*)?$/, '$1'),
        'decrypt',
        extension,
      );
      saved = (await saveFile(result.output, name, mimeType)) === 'saved';
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
    hexKey = '';
    separator = 'auto';
  }
</script>

<div class="space-y-5">
  <FilePicker id="decrypt-file" {file} onselect={selectFile} />

  <div>
    <KeyInput id="decrypt-key" bind:value={hexKey} oninput={clearResult} />
  </div>

  {#if isExcel}
    <p class="text-sm text-slate-600">{i18n.t('file.excelHint')}</p>
  {:else}
    <div>
      <SeparatorSelect
        id="decrypt-separator"
        bind:value={separator}
        onchange={clearResult}
      />
    </div>

    <fieldset>
      <legend class="text-sm font-medium text-slate-700"
        >{i18n.t('decrypt.outputFormat')}</legend
      >
      <label class="mt-1 flex items-center gap-2 text-sm">
        <input
          type="radio"
          value="excel"
          bind:group={outputFormat}
          onchange={clearResult}
        />
        {i18n.t('decrypt.formatExcel')}
      </label>
      <label class="mt-1 flex items-center gap-2 text-sm">
        <input
          type="radio"
          value="utf8-comma"
          bind:group={outputFormat}
          onchange={clearResult}
        />
        {i18n.t('decrypt.formatUtf8')}
      </label>
    </fieldset>
  {/if}

  <button
    type="button"
    class="btn-primary"
    disabled={!canStart}
    onclick={decrypt}
  >
    {working ? i18n.t('action.working') : i18n.t('decrypt.start')}
  </button>

  {#if error}
    <StatusMessage kind="error" text={error} />
  {/if}

  {#if result}
    <div class="space-y-4 border-t border-slate-200 pt-5">
      <StatusMessage
        kind="success"
        text="{i18n.t('decrypt.done')} {inputSummary(i18n.t, result.input)}"
      />
      <div class="flex flex-wrap items-center gap-3">
        <button type="button" class="btn-primary" onclick={save}
          >{i18n.t('decrypt.save')}</button
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
