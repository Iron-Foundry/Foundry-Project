export function parseJson(text: string, origin: string): unknown {
    try {
        return JSON.parse(text);
    } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`${origin} is not readable JSON — ${detail}`, { cause: error });
    }
}

export function narrow<T>(
    value: unknown,
    guard: (candidate: unknown) => candidate is T,
    origin: string,
    shape: string,
): T {
    if (!guard(value)) throw new Error(`${origin} does not satisfy ${shape}`);
    return value;
}

export function readJson<T>(
    text: string,
    guard: (candidate: unknown) => candidate is T,
    origin: string,
    shape: string,
): T {
    return narrow(parseJson(text, origin), guard, origin, shape);
}
