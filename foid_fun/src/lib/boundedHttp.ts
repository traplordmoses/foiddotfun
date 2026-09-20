/** Byte limits apply while streaming, even without Content-Length. */
export class BodyTooLargeError extends Error {
  constructor() { super("Body exceeds the allowed size"); }
}

export async function readBoundedBody(
  response: Pick<Response, "headers" | "body">,
  maxBytes: number,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  if (Number(response.headers.get("content-length")) > maxBytes) {
    void response.body?.cancel().catch(() => {});
    throw new BodyTooLargeError();
  }
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener("abort", abort, { once: true });
  try {
    signal?.throwIfAborted();
    for (;;) {
      const { done, value } = await reader.read();
      signal?.throwIfAborted();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) {
        void reader.cancel().catch(() => {});
        throw new BodyTooLargeError();
      }
      chunks.push(value);
    }
    const result = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
    return result;
  } finally {
    signal?.removeEventListener("abort", abort);
    reader.releaseLock();
  }
}

export async function readBoundedJson<T>(request: Pick<Request, "headers" | "body">, maxBytes: number, signal?: AbortSignal): Promise<T> {
  return JSON.parse(new TextDecoder().decode(await readBoundedBody(request, maxBytes, signal))) as T;
}

/** The same deadline covers connection, headers AND body consumption. */
export async function fetchBounded(url: string, init: RequestInit, maxBytes: number, timeoutMs: number) {
  const controller = new AbortController();
  const abort = () => controller.abort(init.signal?.reason);
  init.signal?.addEventListener("abort", abort, { once: true });
  if (init.signal?.aborted) abort();
  const timer = setTimeout(() => controller.abort(new DOMException("Request timed out", "TimeoutError")), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const bytes = await readBoundedBody(response, maxBytes, controller.signal);
    return { response, bytes };
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener("abort", abort);
  }
}

export function isTimeout(error: unknown) {
  return error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name);
}
