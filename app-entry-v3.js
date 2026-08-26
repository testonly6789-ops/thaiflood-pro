const MIGRATION_KEY = 'thaiflood:ddpm-cache-schema';
const TARGET_VERSION = '3';

try {
  if (localStorage.getItem(MIGRATION_KEY) !== TARGET_VERSION) {
    const prefixes = ['thaiflood:ddpm-fast:', 'thaiflood:ddpm-fast:v2:'];
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i);
      if (key && prefixes.some(prefix => key.startsWith(prefix))) localStorage.removeItem(key);
    }
    localStorage.setItem(MIGRATION_KEY, TARGET_VERSION);
  }
} catch {}

await import('/app-base.js?v=20260826-recurrence-v3');
