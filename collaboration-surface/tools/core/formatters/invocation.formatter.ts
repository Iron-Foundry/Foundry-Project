const QUOTE = '"';

const BARE: ReadonlySet<string> = new Set([
    ..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
    "-",
    "_",
    ".",
    "/",
    ":",
    "=",
    "@",
    ",",
]);

export function shellArgument(argument: string): string {
    if (argument.length > 0 && [...argument].every((character) => BARE.has(character))) return argument;

    let escaped = "";
    for (const character of argument) escaped += character === QUOTE ? `\\${QUOTE}` : character;
    return `${QUOTE}${escaped}${QUOTE}`;
}
