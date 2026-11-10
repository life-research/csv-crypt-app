<script lang="ts">
  const {kind, text}: {kind: 'success' | 'error' | 'info'; text: string} =
    $props();

  const COLORS = {
    success: 'bg-green-50 text-green-800',
    error: 'bg-red-50 text-red-800',
    info: 'bg-slate-100 text-slate-700',
  };
</script>

<p
  class="rounded-md px-3 py-2 text-sm {COLORS[kind]}"
  role={kind === 'error' ? 'alert' : 'status'}
>
  {text}
</p>
