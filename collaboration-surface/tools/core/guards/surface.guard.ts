export const TRANSIENT_OPEN_CODES: ReadonlySet<string> = new Set(["UNKNOWN", "EBUSY", "EPERM", "EACCES"]);

export const OPEN_ATTEMPTS = 8;

const OPEN_SYSCALL = "open";

const BACKOFF_MS = 25;

const PAUSE = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT));

export function isTransientOpenFailure(error: unknown): boolean {
    if (typeof error !== "object" || error === null) return false;

    const candidate = error as { code?: unknown; syscall?: unknown };
    return (
        candidate.syscall === OPEN_SYSCALL &&
        typeof candidate.code === "string" &&
        TRANSIENT_OPEN_CODES.has(candidate.code)
    );
}

export function withOpenRetry<Result>(operation: () => Result): Result {
    for (let attempt = 1; ; attempt += 1) {
        try {
            return operation();
        } catch (error) {
            if (attempt >= OPEN_ATTEMPTS || !isTransientOpenFailure(error)) throw error;
            Atomics.wait(PAUSE, 0, 0, BACKOFF_MS * attempt);
        }
    }
}
