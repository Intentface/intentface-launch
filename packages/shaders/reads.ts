/*
 * What the library reads by URL, counted, so a frame waits for it. The
 * library fetches an image or a shape's field when a node first renders (or
 * when its URL changes), decodes it, and writes it to the GPU on its own
 * schedule; nothing says when that is done, and its record of an image's size
 * is global, so a second renderer finds the size known before its own copy
 * has arrived. Every read of a watched URL is counted from the fetch until
 * the library has its pixels (the bitmap decoded, or the field's bytes read)
 * and has run its own handlers on them, so `settled()` means every node that
 * asked has what it asked for.
 */

/** Fields baked in the page (shape.ts), served from memory. */
const served = new Map<string, ArrayBuffer>();
/** URLs whose reads are counted. */
const watched = new Set<string>();
/** Blobs from counted reads, until they are decoded. */
const pending = new WeakMap<Blob, () => void>();

let reading = 0;
let begun = 0;
let waiting: (() => void)[] = [];

/** How many counted reads have begun so far. */
export const readsBegun = () => begun;

function begin() {
  reading++;
  begun++;
  let done = false;
  return () => {
    if (done) return;
    done = true;
    // After the reader's own continuation (which writes the pixels) has run.
    setTimeout(() => {
      reading--;
      if (reading === 0) for (const resolve of waiting.splice(0)) resolve();
    }, 0);
  };
}

function install() {
  const g = globalThis as typeof globalThis & { __launchReads?: boolean };
  if (g.__launchReads || typeof fetch === "undefined") return;
  g.__launchReads = true;
  const network = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const field = served.get(url);
    if (!field && !watched.has(url)) return network(input, init);
    const end = begin();
    try {
      const response = field ? new Response(field.slice(0)) : await network(input, init);
      const buffer = response.arrayBuffer.bind(response);
      const blob = response.blob.bind(response);
      response.arrayBuffer = () => buffer().finally(end);
      // An image's blob is decoded next: the read ends when it is.
      response.blob = () =>
        blob().then(
          (b) => {
            pending.set(b, end);
            return b;
          },
          (e) => {
            end();
            throw e;
          },
        );
      if (!response.ok) end();
      return response;
    } catch (e) {
      end();
      throw e;
    }
  }) as typeof fetch;
  const decode = globalThis.createImageBitmap.bind(globalThis) as (...a: unknown[]) => Promise<ImageBitmap>;
  globalThis.createImageBitmap = ((source: unknown, ...rest: unknown[]) => {
    const end = source instanceof Blob ? pending.get(source) : undefined;
    const job = decode(source, ...rest);
    if (end) job.finally(end);
    return job;
  }) as typeof createImageBitmap;
}

/** Serve a field's bytes at `url` (counted like any watched read). */
export function serve(url: string, data: ArrayBuffer) {
  install();
  served.set(url, data);
}

/** Whether `url` is a field baked in the page. */
export const isServed = (url: unknown): url is string => typeof url === "string" && served.has(url);

/** Count reads of these URLs from now on. */
export function watch(urls: string[]) {
  install();
  for (const url of urls) watched.add(url);
}

/** Resolves once every counted read has finished (or after `timeout` ms, so a read that never ends cannot hang a render). */
export function settled(timeout = 20_000): Promise<void> {
  if (reading === 0) return Promise.resolve();
  return new Promise((resolve) => {
    waiting.push(resolve);
    setTimeout(() => {
      if (!waiting.includes(resolve)) return;
      waiting = waiting.filter((r) => r !== resolve);
      console.error(`Shaders: ${reading} read(s) still unfinished after ${timeout / 1000} s`);
      resolve();
    }, timeout);
  });
}
