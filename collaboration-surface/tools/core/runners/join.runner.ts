import { spawn } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { readSurface } from "../readers/surface.reader.ts";
import { resolve } from "node:path";

import type { SuiteDeclaration } from "../../../config/join.config.ts";
import { shellArgument } from "../formatters/invocation.formatter.ts";
import {
    claimSuite,
    finishSuite,
    isLive,
    logFile,
    readRecord,
    sameArguments,
    type JoinRecord,
} from "../registries/join.registry.ts";

const POLL_MS = 2000;

const MUTEX_RETRY_MS = 50;

const SPAWN_FAILED = 1;

export interface SuiteRun {
    readonly repoRoot: string;
    readonly suite: string;
    readonly declaration: SuiteDeclaration;
    readonly args: readonly string[];
    readonly agent: string;
}

function pause(milliseconds: number): Promise<void> {
    return new Promise((settle) => {
        setTimeout(settle, milliseconds);
    });
}

function commandLine(declaration: SuiteDeclaration, args: readonly string[]): string {
    return [declaration.command, ...args.map(shellArgument)].join(" ");
}

function stamp(at: number): string {
    return new Date(at).toISOString();
}

function holderOf(record: JoinRecord): string {
    const extra = record.args.length === 0 ? "" : ` ${record.args.join(" ")}`;
    return `${record.agent} (pid ${String(record.pid)} on ${record.host}, started ${stamp(record.at)}, arguments:${extra.length === 0 ? " none" : extra})`;
}

function footer(run: SuiteRun, record: JoinRecord, exitCode: number, joined: boolean): string {
    const report = run.declaration.report === null ? "" : `\nreport: ${run.declaration.report}`;
    const source = joined ? `the joined run by ${holderOf(record)}` : "this run";
    return `\nRESULT  suite ${run.suite} exited ${String(exitCode)} — from ${source}\nlog: ${logFile(run.repoRoot, record)}${report}\n`;
}

async function finish(run: SuiteRun, record: JoinRecord, exitCode: number): Promise<void> {
    while (!finishSuite(run.repoRoot, record, exitCode, Date.now())) await pause(MUTEX_RETRY_MS);
}

function hold(run: SuiteRun, record: JoinRecord): Promise<number> {
    const line = commandLine(run.declaration, run.args);
    process.stdout.write(
        `HOLDING  suite ${run.suite}: ${line} (tree: ${run.declaration.tree}). Every other session asking for this suite ` +
            "joins this run and receives its output instead of starting a second one.\n",
    );

    const log = createWriteStream(logFile(run.repoRoot, record), { encoding: "utf8" });

    return new Promise((settle) => {
        const child = spawn(line, {
            cwd: resolve(run.repoRoot, run.declaration.tree),
            shell: true,
            stdio: ["ignore", "pipe", "pipe"],
        });

        child.stdout.on("data", (chunk: Buffer) => {
            process.stdout.write(chunk);
            log.write(chunk);
        });
        child.stderr.on("data", (chunk: Buffer) => {
            process.stderr.write(chunk);
            log.write(chunk);
        });

        let settled = false;
        const close = (exitCode: number): void => {
            if (settled) return;
            settled = true;
            log.end(() => {
                void finish(run, record, exitCode).then(() => {
                    process.stdout.write(footer(run, record, exitCode, false));
                    settle(exitCode);
                });
            });
        };

        child.on("error", (raised) => {
            const message = `SPAWN FAILED  ${String(raised)}\n`;
            process.stderr.write(message);
            log.write(message);
            close(SPAWN_FAILED);
        });
        child.on("close", (code) => {
            close(code ?? SPAWN_FAILED);
        });
    });
}

async function awaitRun(run: SuiteRun, watched: JoinRecord): Promise<JoinRecord | null> {
    for (;;) {
        await pause(POLL_MS);

        const held = readRecord(run.repoRoot, run.suite);
        if (held === null || held.at !== watched.at || held.pid !== watched.pid) return null;
        if (held.state === "finished") return held;
        if (!isLive(held, Date.now())) {
            process.stdout.write(
                `ABANDONED  the run by ${holderOf(held)} stopped without a verdict. This session takes the suite over.\n`,
            );
            return null;
        }
    }
}

function replay(run: SuiteRun, record: JoinRecord): number {
    const path = logFile(run.repoRoot, record);
    if (existsSync(path)) process.stdout.write(readSurface(path, "utf8"));

    const exitCode = record.exitCode ?? SPAWN_FAILED;
    process.stdout.write(footer(run, record, exitCode, true));
    return exitCode;
}

export async function joinSuite(run: SuiteRun): Promise<number> {
    for (;;) {
        const standing = claimSuite(run.repoRoot, {
            suite: run.suite,
            args: run.args,
            agent: run.agent,
            pid: process.pid,
            now: Date.now(),
        });

        if (standing === null) {
            await pause(MUTEX_RETRY_MS);
            continue;
        }

        if (standing.role === "hold") return hold(run, standing.record);

        const same = sameArguments(standing.record.args, run.args);
        process.stdout.write(
            same
                ? `JOINED  suite ${run.suite} is already running with the same arguments, held by ${holderOf(standing.record)}. ` +
                      "This session waits for that run and receives its output rather than starting a second one.\n"
                : `QUEUED  suite ${run.suite} is already running with other arguments, held by ${holderOf(standing.record)}. ` +
                      "This session waits for that run to finish and then runs its own.\n",
        );

        const outcome = await awaitRun(run, standing.record);
        if (outcome !== null && same) return replay(run, outcome);
    }
}
