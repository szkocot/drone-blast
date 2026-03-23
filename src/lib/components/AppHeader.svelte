<!-- src/lib/components/AppHeader.svelte -->
<script lang="ts">
  import { t } from '../i18n/en';
  export let locationName: string;

  const dateStr = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
</script>

<header>
  <div class="left">
    <span class="app-name">{t.appName}</span>
    <div class="loc-row">
      <span class="dot"></span>
      <span class="loc">{locationName || '…'}</span>
    </div>
  </div>
  <span class="date">{dateStr}</span>
</header>

<style>
  header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 10px 16px;
    background: var(--surface2);
    border-bottom: 1px solid var(--border);
  }
  .app-name { font-size: 16px; font-weight: 900; color: var(--blue); letter-spacing: 1.5px; }
  .loc-row  { display: flex; align-items: center; gap: 5px; margin-top: 2px; }
  .dot      { width: 6px; height: 6px; border-radius: 50%; background: var(--green); flex-shrink: 0; }
  .loc      { font-size: 11px; color: var(--text-muted); }
  .date     { font-size: 11px; color: var(--text-muted); }

  @media (min-width: 1024px) {
    header {
      padding: 16px 20px 14px;
      align-items: flex-end;
    }

    .app-name {
      font-size: 18px;
      letter-spacing: 1.8px;
    }

    .loc-row {
      gap: 7px;
      margin-top: 5px;
    }

    .loc,
    .date {
      font-size: 12px;
    }
  }
</style>
