import { JOIN_NOTE, suites } from "../../../config/join.config.ts";
import { projectRoot } from "../../../config/surface.config.ts";
import { joinSuite } from "../runners/join.runner.ts";

const SUITE_FLAG = "--suite";

const AGENT_FLAG = "--agent";

const LIST_FLAG = "--list";

const PASS_THROUGH = "--";

const UNNAMED_AGENT = "session";

const REFUSED = 2;

interface JoinArguments {
    readonly suite: string | null;
    readonly agent: string;
    readonly list: boolean;
    readonly extra: readonly string[];
}

function parsed(argv: readonly string[]): JoinArguments {
    const split = argv.indexOf(PASS_THROUGH);
    const own = split === -1 ? argv : argv.slice(0, split);
    const extra = split === -1 ? [] : argv.slice(split + 1);

    const valueAfter = (flag: string): string | null => {
        const at = own.indexOf(flag);
        return at === -1 ? null : (own[at + 1] ?? null);
    };

    return {
        suite: valueAfter(SUITE_FLAG),
        agent: valueAfter(AGENT_FLAG) ?? UNNAMED_AGENT,
        list: own.includes(LIST_FLAG),
        extra,
    };
}

function listing(): string {
    const rows = Object.entries(suites).map(
        ([id, declaration]) => `  ${id.padEnd(28)} ${declaration.command}  (in ${declaration.tree})`,
    );
    return `${JOIN_NOTE}\n\nSUITES\n${rows.join("\n")}\n\nusage: npm run join -- --suite <id> [--agent <label>] [-- <extra arguments>]\n`;
}

async function main(): Promise<number> {
    const request = parsed(process.argv.slice(2));

    if (request.list) {
        process.stdout.write(listing());
        return 0;
    }

    const declaration = request.suite === null ? undefined : suites[request.suite];
    if (request.suite === null || declaration === undefined) {
        process.stdout.write(
            `REFUSED  ${request.suite === null ? "no suite was named" : `no suite is declared as ${request.suite}`}. ` +
                "A run the lock cannot identify cannot be joined by anyone else, so it is not started.\n\n" +
                listing(),
        );
        return REFUSED;
    }

    return joinSuite({
        repoRoot: projectRoot(),
        suite: request.suite,
        declaration,
        args: request.extra,
        agent: request.agent,
    });
}

process.exit(await main());
