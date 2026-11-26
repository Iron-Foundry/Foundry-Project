export interface SuiteDeclaration {
    readonly tree: string;
    readonly command: string;
    readonly report: string | null;
    readonly note: string;
}

const WORKSPACE = ".";

export const JOIN_NOTE =
    "every HOST suite a session may run, keyed by a stable id. A suite is one command in one tree, and it is the unit of exclusion: two sessions never run one suite at once, because a gate that rewrites files and a gate that reads them race over one tree and each reports an interleaving rather than a state. The tree is relative to the project root and mirrors the host's own path keys; the command is matched as a token prefix by the invocation guard, so a narrowed invocation of the same command is the same suite. A host adds a suite by adding a row, and the guard and the lock both read it with no other edit.";

export const suites: Readonly<Record<string, SuiteDeclaration>> = {
    "foundry-lint": {
        tree: WORKSPACE,
        command: "bash run-tests.sh lint",
        report: null,
        note: "ruff check, ruff format --check and pyright per Python module, and the web-app typecheck.",
    },
    "foundry-fast": {
        tree: WORKSPACE,
        command: "bash run-tests.sh fast",
        report: null,
        note: "the suites that need no Docker: api-backend, discord-server, discord-utils and the web-app unit tests.",
    },
    "foundry-integration": {
        tree: WORKSPACE,
        command: "bash run-tests.sh integration",
        report: null,
        note: "the real-infra suites against one shared Postgres and Valkey pair. Needs Docker.",
    },
    "foundry-e2e": {
        tree: WORKSPACE,
        command: "bash run-tests.sh e2e",
        report: null,
        note: "the full stack in Docker compose: Playwright and discord_e2e. It tears the stack down on exit.",
    },
    "foundry-all": {
        tree: WORKSPACE,
        command: "bash run-tests.sh all",
        report: null,
        note: "every lane in order: lint, fast, integration, e2e.",
    },
};
