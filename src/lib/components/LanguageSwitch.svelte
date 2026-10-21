<script lang="ts">
  import {i18n} from '#lib/i18n/i18n.svelte.ts';
  import {LANGUAGES} from '#lib/i18n/i18n.ts';
</script>

<div class="flex gap-1" role="group" aria-label={i18n.t('language.label')}>
  {#each LANGUAGES as language (language)}
    <button
      type="button"
      class="rounded px-2 py-1 text-sm uppercase {i18n.language === language
        ? 'bg-slate-800 text-white'
        : 'text-slate-600 hover:bg-slate-200'}"
      aria-pressed={i18n.language === language}
      onclick={() => (i18n.language = language)}
    >
      {language}
    </button>
  {/each}
</div>
