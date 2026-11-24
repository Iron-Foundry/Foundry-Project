import { BINDING_PATH, BINDING_SOURCE, SLOT_CONSUMERS } from "../core/constants/binding.constants.ts";
import { renderBinding, writeBinding } from "../core/generators/binding.generator.ts";
import { underRoots } from "../core/filters/scope.filter.ts";
import { enumeratesVocabulary, type Resolution, slotStates, slotsIn } from "../core/analyzers/binding.analyzer.ts";
import type { RuleContext, RuleDeclaration, RuleResult } from "../core/types/rule.types.ts";
import type { Finding } from "../core/types/segment.types.ts";

function finding(path: string, line: number, slot: string): Finding {
    return {
        rule: "binding/unresolvedSlot",
        path,
        line,
        locus: slot,
        stack: [
            { check: "slot", resolved: slot },
            { check: "binding", resolved: BINDING_PATH },
            { check: "resolution", resolved: "absent" },
        ],
        actual: `${slot} is consumed but the adapter binding does not resolve it`,
        expected: `${slot} declared in ${BINDING_PATH}, or resolved ABSENT`,
        remediation: {
            action: "declare",
            from: slot,
            to: BINDING_PATH,
            target: path,
            deterministic: false,
            decide: `an abstract slot resolves against the adapter binding or resolves ABSENT, and an ABSENT slot means the branch using it does not run — which is declared rather than faked. Two artifacts can carry the repair and only one of them is this finding's subject: either ${path} stops naming ${slot}, or ${BINDING_PATH} binds it to its project value or declares it ABSENT. Deciding which is the judgement, so neither is offered as the target`,
        },
        healed: false,
    };
}

function misSectioned(path: string, line: number, slot: string, actual: string): Finding {
    return {
        rule: "binding/slotInWrongSection",
        path,
        line,
        locus: slot,
        stack: [
            { check: "slot", resolved: slot },
            { check: "declared", resolved: actual },
        ],
        actual: `${slot} names a section that does not declare it, and ${actual} does`,
        expected: actual,
        remediation: { action: "rename", from: slot, to: actual, target: path, deterministic: true, decide: "" },
        healed: false,
    };
}

function unhonoured(path: string, line: number, slot: string, state: Resolution): Finding {
    return {
        rule: "binding/stateNotHonoured",
        path,
        line,
        locus: slot,
        stack: [
            { check: "slot", resolved: slot },
            { check: "binding", resolved: BINDING_PATH },
            { check: "resolution", resolved: state },
        ],
        actual: `${slot} is consumed as though it resolved, and the adapter resolves it ${state}`,
        expected: `the consuming line names ${state}, so the branch reading ${slot} does not run`,
        remediation: {
            action: "declare",
            from: slot,
            to: state,
            target: path,
            deterministic: false,
            decide: `a slot has three resolution states and only one of them lets its branch run. The adapter is checked for whether a slot is DECLARED; nothing checks whether the CONSUMER honours what it declares, so a spec reading a non-resolving slot as though it resolved passes every existing check — which makes a gate satisfiable only by fabricating the evidence it demands. Two repairs are available and choosing between them is the judgement: ${path} states the ${state} resolution at the consuming line and does not run that branch, or it stops naming ${slot} at all. ABSENT means this deployment has no analogue and the branch is skipped; DEFERRED means the branch is BLOCKED rather than skipped, and collapsing the second into the first answers a different question in the right shape`,
        },
        healed: false,
    };
}

function drifted(path: string): Finding {
    return {
        rule: "binding/bindingDrift",
        path,
        line: 0,
        locus: "adapter binding",
        stack: [
            { check: "source", resolved: "the surface configuration" },
            { check: "rendered", resolved: "differs from the document on disk" },
        ],
        actual: "the adapter binding on disk differs from the configuration it is rendered from",
        expected: "the rendered binding",
        remediation: {
            action: "none",
            from: path,
            to: null,
            target: BINDING_SOURCE,
            deterministic: true,
            decide: "the binding is RENDERED, so the repair lands in the configuration it is rendered from and a healing run re-renders it; an edit to the rendered file is overwritten by the next run",
        },
        healed: true,
    };
}

export const rule: RuleDeclaration = {
    stage: "content",
    jurisdiction: "taxonomy",
    invariant:
        "every abstract slot a consumer names resolves through the adapter binding, and the binding is rendered from the configuration rather than authored beside it",
    extensions: [".md"],
    kinds: ["unresolvedSlot", "slotInWrongSection", "stateNotHonoured", "bindingDrift"],
    heals: true,

    reads: [BINDING_PATH],

    check(context: RuleContext, fix: boolean): RuleResult {
        const healed: string[] = [];
        const rendered = renderBinding();
        const onDisk = context.exists(BINDING_PATH) ? context.read(BINDING_PATH) : null;

        if (onDisk !== rendered) {
            if (fix) {
                writeBinding(context.repoRoot, rendered);
                healed.push(BINDING_PATH);
            }
        }

        if (!context.paths.includes(BINDING_PATH)) {
            return {
                findings: healed.length > 0 ? [drifted(BINDING_PATH)] : [],
                healed,
                derivations: { binding: "rendered" },
            };
        }

        const declared = new Set<string>();
        const namespaces = new Set<string>();
        const byName = new Map<string, string>();

        for (const slot of slotsIn(rendered)) {
            declared.add(slot.name);
            const body = slot.name.slice(1, -1);
            const dot = body.indexOf(".");
            if (dot <= 0) continue;
            namespaces.add(body.slice(0, dot));
            byName.set(body.slice(dot + 1), slot.name);
        }

        const states = slotStates(rendered);
        const findings: Finding[] = [];
        const scoped = underRoots(context.paths, SLOT_CONSUMERS);

        for (const path of scoped) {
            if (path === BINDING_PATH) continue;

            const source = context.read(path);
            const lines = source.split("\n");
            const seen = new Set<string>();
            const honoured = new Set<string>();

            let block: string[] = [];
            const closeBlock = (): void => {
                const text = block.join("\n");
                for (const use of slotsIn(text)) {
                    const state = states.get(use.name);
                    if (state === undefined) continue;
                    if (text.includes(state)) honoured.add(use.name);
                }
                block = [];
            };

            for (const line of lines) {
                if (line.trim().length === 0) closeBlock();
                else block.push(line);
            }
            closeBlock();

            const unstated = new Set<string>();
            for (const slot of slotsIn(source)) {
                const state = states.get(slot.name);
                const mention = enumeratesVocabulary(lines[slot.line - 1] ?? "");
                if (
                    !mention &&
                    state !== undefined &&
                    state !== "RESOLVED" &&
                    !honoured.has(slot.name) &&
                    !unstated.has(slot.name)
                ) {
                    unstated.add(slot.name);
                    findings.push(unhonoured(path, slot.line, slot.name, state));
                }

                if (declared.has(slot.name)) continue;

                const body = slot.name.slice(1, -1);
                const dot = body.indexOf(".");
                if (dot <= 0) continue;
                if (!namespaces.has(body.slice(0, dot))) continue;
                if (seen.has(slot.name)) continue;
                seen.add(slot.name);

                const elsewhere = byName.get(body.slice(dot + 1));
                if (elsewhere !== undefined) {
                    findings.push(misSectioned(path, slot.line, slot.name, elsewhere));
                    continue;
                }

                findings.push(finding(path, slot.line, slot.name));
            }
        }

        if (healed.length > 0) findings.push(drifted(BINDING_PATH));

        return { findings, healed, derivations: { declared: [...declared].sort(), consumers: scoped.length } };
    },
};
