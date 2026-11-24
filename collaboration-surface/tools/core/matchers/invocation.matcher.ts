import { resolve } from "node:path";

export interface DeclaredSuite {
    readonly id: string;
    readonly tree: string;
    readonly command: string;
}

export interface SuiteMatch {
    readonly id: string;
    readonly extra: readonly string[];
}

export interface Clause {
    readonly text: string;
    readonly piped: boolean;
}

const QUOTES: ReadonlySet<string> = new Set(['"', "'"]);

const PIPE = "|";

const PACKAGE_MANAGER = "npm";

const RUN = "run";

const PREFIX = "--prefix";

const ARGUMENT_BREAK = "--";

const MERGED_ERROR = "2>&1";

const DELIVERING_SCRIPTS: ReadonlySet<string> = new Set(["join"]);

const BREAKS: ReadonlySet<string> = new Set([";", "\n", "|", "&"]);

const SPACES: ReadonlySet<string> = new Set([" ", "\t", "\r"]);

const CHANGE_DIRECTORY = "cd";

const HOME = "~";

const ASSIGNMENT = "=";

const OPTION_LEAD = "-";

const DRIVE_LEAD = "/";

const REDIRECT = ">";

const INPUT = "<";

const AMPERSAND = "&";

const DIRECTORY_OPTIONS: Readonly<Record<string, readonly string[]>> = {
    uv: ["--directory"],
    npm: ["--prefix"],
};

interface Relocated {
    readonly tokens: readonly string[];
    readonly here: string;
}

function isBreak(command: string, index: number): boolean {
    const character = command.charAt(index);
    if (!BREAKS.has(character)) return false;
    if (character !== AMPERSAND) return true;
    return command.charAt(index - 1) !== REDIRECT && command.charAt(index + 1) !== REDIRECT;
}

function isPipe(command: string, index: number): boolean {
    return command.charAt(index) === PIPE && command.charAt(index - 1) !== PIPE && command.charAt(index + 1) !== PIPE;
}

export function clausesOf(command: string): Clause[] {
    const out: Clause[] = [];
    let held = "";
    let quote = "";

    for (let index = 0; index < command.length; index += 1) {
        const character = command.charAt(index);

        if (quote.length > 0) {
            held += character;
            if (character === quote) quote = "";
            continue;
        }

        if (QUOTES.has(character)) {
            quote = character;
            held += character;
            continue;
        }

        if (isBreak(command, index)) {
            if (held.trim().length > 0) out.push({ text: held.trim(), piped: isPipe(command, index) });
            held = "";
            continue;
        }

        held += character;
    }

    if (held.trim().length > 0) out.push({ text: held.trim(), piped: false });
    return out;
}

export function segmentsOf(command: string): string[] {
    return clausesOf(command).map((clause) => clause.text);
}

function divertsOutput(clause: string): boolean {
    let quote = "";
    let word = "";
    let redirects = false;

    const diverting = (): boolean => redirects && word !== MERGED_ERROR;

    for (const character of clause) {
        if (quote.length > 0) {
            if (character === quote) quote = "";
            word += character;
            continue;
        }

        if (QUOTES.has(character)) {
            quote = character;
            word += character;
            continue;
        }

        if (SPACES.has(character)) {
            if (diverting()) return true;
            word = "";
            redirects = false;
            continue;
        }

        if (character === REDIRECT) redirects = true;
        word += character;
    }

    return diverting();
}

function withoutRedirections(tokens: readonly string[]): string[] {
    const out: string[] = [];
    for (let index = 0; index < tokens.length; index += 1) {
        const token = tokens[index] ?? "";
        const bare = token === REDIRECT || token === `${REDIRECT}${REDIRECT}` || token === INPUT;
        if (bare) {
            index += 1;
            continue;
        }
        if (token.includes(REDIRECT) || token.includes(INPUT)) continue;
        out.push(token);
    }
    return out;
}

export function tokensOf(segment: string): string[] {
    const out: string[] = [];
    let held = "";
    let quote = "";
    let open = false;

    for (const character of segment) {
        if (quote.length > 0) {
            if (character === quote) quote = "";
            else held += character;
            continue;
        }

        if (QUOTES.has(character)) {
            quote = character;
            open = true;
            continue;
        }

        if (SPACES.has(character)) {
            if (open) out.push(held);
            held = "";
            open = false;
            continue;
        }

        held += character;
        open = true;
    }

    if (open) out.push(held);
    return out;
}

function withoutAssignments(tokens: readonly string[]): string[] {
    let start = 0;
    while (start < tokens.length) {
        const token = tokens[start] ?? "";
        if (token.startsWith(OPTION_LEAD) || !token.includes(ASSIGNMENT)) break;
        start += 1;
    }
    return tokens.slice(start);
}

function driveForm(path: string): string {
    const letter = path.charAt(1);
    const isLetter = (letter >= "a" && letter <= "z") || (letter >= "A" && letter <= "Z");
    const rooted = path.startsWith(DRIVE_LEAD) && isLetter && (path.length === 2 || path.charAt(2) === DRIVE_LEAD);
    return rooted ? `${letter.toUpperCase()}:${path.slice(2)}` : path;
}

export function directoryAfter(target: string | undefined, here: string, home: string): string {
    if (target === undefined || target === HOME) return home;
    if (target.startsWith(`${HOME}${DRIVE_LEAD}`)) return resolve(home, target.slice(2));
    return resolve(here, driveForm(target));
}

export function samePath(left: string, right: string, caseless: boolean): boolean {
    const normal = (path: string): string => {
        let out = "";
        for (const character of resolve(path)) out += character === "\\" ? "/" : character;
        while (out.length > 1 && out.endsWith("/")) out = out.slice(0, -1);
        return caseless ? out.toLowerCase() : out;
    };
    return normal(left) === normal(right);
}

function deliveringPackage(tokens: readonly string[], here: string): string | null {
    if (tokens[0] !== PACKAGE_MANAGER) return null;
    let directory = here;

    for (let index = 1; index < tokens.length; index += 1) {
        const token = tokens[index] ?? "";
        if (token === ARGUMENT_BREAK) return null;

        if (token === PREFIX) {
            directory = resolve(here, driveForm(tokens[index + 1] ?? ""));
            index += 1;
            continue;
        }

        if (token.startsWith(`${PREFIX}${ASSIGNMENT}`)) {
            directory = resolve(here, driveForm(token.slice(PREFIX.length + ASSIGNMENT.length)));
            continue;
        }

        if (token === RUN) return DELIVERING_SCRIPTS.has(tokens[index + 1] ?? "") ? directory : null;
    }

    return null;
}

export function filteredDeliveries(
    command: string,
    cwd: string,
    surface: string,
    home: string,
    caseless: boolean,
): string[] {
    const out: string[] = [];
    let here = cwd;

    for (const clause of clausesOf(command)) {
        const tokens = withoutAssignments(tokensOf(clause.text));
        if (tokens.length === 0) continue;

        if (tokens[0] === CHANGE_DIRECTORY) {
            here = directoryAfter(tokens[1], here, home);
            continue;
        }

        const directory = deliveringPackage(tokens, here);
        if (directory === null || !samePath(directory, surface, caseless)) continue;
        if (clause.piped || divertsOutput(clause.text)) out.push(clause.text);
    }

    return out;
}

function relocated(tokens: readonly string[], here: string): Relocated {
    const options = DIRECTORY_OPTIONS[tokens[0] ?? ""] ?? [];
    const out: string[] = [];
    let directory = here;

    for (let index = 0; index < tokens.length; index += 1) {
        const token = tokens[index] ?? "";
        if (token === ARGUMENT_BREAK) return { tokens: [...out, ...tokens.slice(index)], here: directory };

        if (options.includes(token)) {
            directory = resolve(here, driveForm(tokens[index + 1] ?? ""));
            index += 1;
            continue;
        }

        const joined = options.find((option) => token.startsWith(`${option}${ASSIGNMENT}`));
        if (joined !== undefined) {
            directory = resolve(here, driveForm(token.slice(joined.length + ASSIGNMENT.length)));
            continue;
        }

        out.push(token);
    }

    return { tokens: out, here: directory };
}

function prefixOf(expected: readonly string[], tokens: readonly string[]): boolean {
    return expected.length <= tokens.length && expected.every((token, index) => tokens[index] === token);
}

export function matchedSuites(
    command: string,
    cwd: string,
    declared: readonly DeclaredSuite[],
    home: string,
    caseless: boolean,
): SuiteMatch[] {
    const out: SuiteMatch[] = [];
    let here = cwd;

    for (const segment of segmentsOf(command)) {
        const tokens = withoutRedirections(withoutAssignments(tokensOf(segment)));
        if (tokens.length === 0) continue;

        if (tokens[0] === CHANGE_DIRECTORY) {
            here = directoryAfter(tokens[1], here, home);
            continue;
        }

        const run = relocated(tokens, here);
        for (const suite of declared) {
            const expected = tokensOf(suite.command);
            if (!prefixOf(expected, run.tokens)) continue;
            if (!samePath(run.here, suite.tree, caseless)) continue;
            out.push({ id: suite.id, extra: run.tokens.slice(expected.length) });
        }
    }

    return out;
}
