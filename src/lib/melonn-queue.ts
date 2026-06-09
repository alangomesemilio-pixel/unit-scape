// Fila global de chamadas Melonn no cliente.
// Garante UMA chamada por vez, com intervalo mínimo de 1200ms entre elas,
// e retry exponencial em 429 / falhas transitórias.
//
// Workers serverless rodam em isolates independentes, então o throttle in-memory
// do servidor não é compartilhado. Serializar no cliente é a forma confiável.

const MIN_INTERVAL_MS = 1200;
const MAX_RETRIES = 3;

let lastCallAt = 0;
let chainTail: Promise<unknown> = Promise.resolve();

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function is429(err: unknown): boolean {
  const msg = String((err as any)?.message ?? err ?? "");
  return /\b429\b|too\s*many\s*requests|rate\s*limit/i.test(msg);
}

export function melonnQueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = async (): Promise<T> => {
    const wait = Math.max(0, MIN_INTERVAL_MS - (Date.now() - lastCallAt));
    if (wait > 0) await sleep(wait);
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      lastCallAt = Date.now();
      try {
        const result = await fn();
        // Algumas serverFns retornam { error } sem lançar — verificar 429 também.
        const errMsg = (result as any)?.error;
        if (typeof errMsg === "string" && is429(errMsg) && attempt < MAX_RETRIES - 1) {
          await sleep(2000 * (attempt + 1));
          continue;
        }
        return result;
      } catch (err) {
        if (is429(err) && attempt < MAX_RETRIES - 1) {
          await sleep(2000 * (attempt + 1));
          continue;
        }
        if (attempt < MAX_RETRIES - 1) {
          await sleep(1000 * (attempt + 1));
          continue;
        }
        throw err;
      }
    }
    throw new Error("Melonn: max retries exceeded");
  };

  // Encadeia para garantir execução estritamente serial.
  const next = chainTail.then(run, run);
  chainTail = next.catch(() => undefined);
  return next;
}
