<script lang="ts">
  import {isCancelled} from '#lib/batches.ts';
  import {isValidHexKey} from '#lib/crypto/key.ts';
  import {
    decryptFile,
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
  import FilePicker from './FilePicker.svelte';
  import KeyInput from './KeyInput.svelte';
  import SeparatorSelect from './SeparatorSelect.svelte';
  import StatusMessage from './StatusMessage.svelte';
  import WorkProgress from './WorkProgress.svelte';

  let file = $state<File | null>(null);
  let hexKey = $state('');
  let separator = $state<SeparatorChoice>('auto');
  let outputFormat = $state<OutputFormat>('excel');
  let working = $state(false);
  let result = $state<FileResult | null>(null);
  let error = $state('');
  let saved = $state(false);
  let progress = $state(0);
  let cancelled = $state(false);
  // Set while the work runs; `abort()` stops the work.
  let controller: AbortController | null = null;

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
    progress = 0;
    controller = new AbortController();
    try {
      const input = new Uint8Array(await file.arrayBuffer());
      const decrypted = await decryptFile(input, hexKey, {
        separator,
        outputFormat,
        signal: controller.signal,
        onProgress: (fraction) => (progress = fraction),
      });
      if (decrypted.ok) {
        result = decrypted;
      } else {
        error = decryptErrorMessage(
          i18n.t,
          decrypted.lineNumber,
          decrypted.error,
        );
      }
    } catch (caught) {
      if (isCancelled(caught)) {
        cancelled = true;
      } else {
        error = unexpectedErrorMessage(i18n.t, caught);
      }
    } finally {
      working = false;
      controller = null;
    }
  }

  async function save() {
    if (result && file) {
      const name = outputFileName(
        file.name.replace(/_crypt(\.[^.]*)?$/, '$1'),
        'decrypt',
      );
      saved = (await saveFile(result.output, name, 'text/csv')) === 'saved';
    }
  }

  /** A change of the input also stops the work that is running. */
  function clearResult() {
    controller?.abort();
    cancelled = false;
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
  <FilePicker
    id="decrypt-file"
    {file}
    onselect={selectFile}
    disabled={working}
  />

  <div>
    <KeyInput id="decrypt-key" bind:value={hexKey} oninput={clearResult} />
  </div>

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

  <button
    type="button"
    class="btn-primary"
    disabled={!canStart}
    onclick={decrypt}
  >
    {working ? i18n.t('action.working') : i18n.t('decrypt.start')}
  </button>

  {#if working}
    <WorkProgress fraction={progress} oncancel={() => controller?.abort()} />
  {/if}

  {#if error}
    <StatusMessage kind="error" text={error} />
  {/if}

  {#if cancelled}
    <StatusMessage kind="info" text={i18n.t('action.cancelled')} />
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
