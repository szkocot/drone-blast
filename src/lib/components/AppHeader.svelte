<!-- src/lib/components/AppHeader.svelte -->
<script lang="ts">
  import { t } from '../i18n';
  export let locationName: string;

  const dateStr = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
</script>

<header>
  <div class="left">
    <span class="app-name">{$t.appName}</span>
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
    gap: 12px;
    padding: calc(10px + var(--safe-top)) 16px 10px;
    background: var(--surface2);
    border-bottom: 1px solid var(--border);
  }
  .left     { min-width: 0; }
  .app-name { font-size: 16px; font-weight: 900; color: var(--blue); letter-spacing: 1.5px; }
  .loc-row  { display: flex; align-items: center; gap: 5px; margin-top: 2px; }
  .dot      { width: 6px; height: 6px; border-radius: 50%; background: var(--green); flex-shrink: 0; }
  .loc      { font-size: 13px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .date     { font-size: 13px; color: var(--text-muted); flex-shrink: 0; white-space: nowrap; }

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
      font-size: 13px;
    }
  }
</style>
