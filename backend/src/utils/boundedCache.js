// A Map that never holds more than `maxEntries` items: when a new key pushes it over the limit, the
// OLDEST inserted key is dropped (first-in, first-out). Used for in-memory caches so a long-running
// server cannot grow without limit. Returns the value so it can be used inline.
export function boundedSet(cache, key, value, maxEntries) {
  if (!Number.isInteger(maxEntries) || maxEntries < 1) throw new Error('maxEntries must be a positive integer.');
  cache.delete(key); // re-inserting an existing key makes it the newest
  cache.set(key, value);
  while (cache.size > maxEntries) cache.delete(cache.keys().next().value);
  return value;
}
