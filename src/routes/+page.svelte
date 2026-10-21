<script lang="ts">
  import DecryptPanel from '#lib/components/DecryptPanel.svelte';
  import EncryptPanel from '#lib/components/EncryptPanel.svelte';
  import LanguageSwitch from '#lib/components/LanguageSwitch.svelte';
  import {i18n} from '#lib/i18n/i18n.svelte.ts';

  type Tab = 'encrypt' | 'decrypt';
  const TABS: Tab[] = ['encrypt', 'decrypt'];

  let activeTab = $state<Tab>('encrypt');

  $effect(() => {
    document.documentElement.lang = i18n.language;
  });
</script>

<svelte:head>
  <title>{i18n.t('app.title')}</title>
</svelte:head>

<div class="min-h-screen bg-slate-100 text-slate-900">
  <main class="mx-auto max-w-2xl px-4 py-8">
    <header class="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold">{i18n.t('app.title')}</h1>
        <p class="mt-1 text-slate-600">{i18n.t('app.subtitle')}</p>
      </div>
      <LanguageSwitch />
    </header>

    <p class="mb-6 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-900">
      {i18n.t('app.privacy')}
    </p>

    <section class="rounded-xl bg-white shadow-sm">
      <div class="flex border-b border-slate-200" role="tablist">
        {#each TABS as tab (tab)}
          <button
            type="button"
            role="tab"
            id="tab-{tab}"
            aria-selected={activeTab === tab}
            aria-controls="panel-{tab}"
            class="flex-1 px-4 py-3 font-medium {activeTab === tab
              ? 'border-b-2 border-blue-700 text-blue-800'
              : 'text-slate-500 hover:text-slate-800'}"
            onclick={() => (activeTab = tab)}
          >
            {i18n.t(`tab.${tab}`)}
          </button>
        {/each}
      </div>

      <!-- Both panels stay mounted, so switching tabs keeps their state. -->
      <div class="p-6">
        <div
          id="panel-encrypt"
          role="tabpanel"
          aria-labelledby="tab-encrypt"
          hidden={activeTab !== 'encrypt'}
        >
          <EncryptPanel />
        </div>
        <div
          id="panel-decrypt"
          role="tabpanel"
          aria-labelledby="tab-decrypt"
          hidden={activeTab !== 'decrypt'}
        >
          <DecryptPanel />
        </div>
      </div>
    </section>

    <footer class="mt-6 text-center text-xs text-slate-500">
      {i18n.t('app.version', {version: __APP_VERSION__})}
    </footer>
  </main>
</div>
