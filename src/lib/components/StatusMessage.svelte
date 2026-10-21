<script lang="ts">
  const {kind, text}: {kind: 'success' | 'error'; text: string} = $props();
</script>

<p
  class="rounded-md px-3 py-2 text-sm {kind === 'error'
    ? 'bg-red-50 text-red-800'
    : 'bg-green-50 text-green-800'}"
  role={kind === 'error' ? 'alert' : 'status'}
>
  {text}
</p>
