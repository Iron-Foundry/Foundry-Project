import { spawnSync } from "node:child_process";

export interface ProcessResult {
    readonly step: string;
    readonly tool: string;
    readonly checks: string;
    readonly verdict: "pass" | "fail";
    readonly exitCode: number;
    readonly output: string;
}

export function runTool(
    cwd: string,
    step: string,
    tool: string,
    checks: string,
    args: readonly string[],
    env?: NodeJS.ProcessEnv,
): ProcessResult {
    const result = spawnSync(`${tool} ${args.join(" ")}`.trim(), {
        cwd,
        encoding: "utf8",
        shell: true,
        env: env === undefined ? process.env : { ...process.env, ...env },
    });

    const failure = result.error === undefined ? "" : String(result.error);
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}${failure}`.trim();
    const exitCode = result.error !== undefined ? -1 : (result.status ?? -1);

    return { step, tool, checks, verdict: exitCode === 0 ? "pass" : "fail", exitCode, output };
}
