const UNIT_CACHE_SCHEMA_KEY = 'thaiflood:agriculture-unit-schema';
const UNIT_CACHE_SCHEMA = 'v1-source-units';

try {
  if (localStorage.getItem(UNIT_CACHE_SCHEMA_KEY) !== UNIT_CACHE_SCHEMA) {
    const prefixes = ['thaiflood:ddpm-fast:', 'thaiflood:ddpm-fast:v2:', 'thaiflood:ddpm-fast:v3:', 'thaiflood:ddpm-fast:v4:'];
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i);
      if (key && prefixes.some(prefix => key.startsWith(prefix))) localStorage.removeItem(key);
    }
    localStorage.setItem(UNIT_CACHE_SCHEMA_KEY, UNIT_CACHE_SCHEMA);
  }
} catch {}

await import('/app-entry-v3.js?v=20260826-all77-unitfix1');
