import { ENTRY_PATH, MANIFEST_PATH } from "../constants/manifest.constants.ts";
import { SURFACE_ROOT } from "../constants/path.constants.ts";
import { renderEntry } from "../generators/manifest.generator.ts";
import { climbsOut, inspectManifests } from "../inspectors/manifest.inspector.ts";
import type { BranchFixture, BranchObservation } from "./converge.fixture.ts";
import type { GateFixture } from "./gate.fixture.ts";

const MANIFEST = SURFACE_ROOT.length === 0 ? "package.json" : `${SURFACE_ROOT}/package.json`;

const CLAIMING = JSON.stringify({
    name: "probe",
    scripts: { generate: "node ../../a-host-framework/bin/generate.ts" },
});

const CONTAINED = JSON.stringify({
    name: "probe",
    scripts: { generate: "node tools/core/entrypoints/pipeline.entrypoint.ts" },
});

function inspecting(root: string): BranchObservation {
    const findings = inspectManifests(root, []);

    return {
        claims: findings.filter((finding) => finding.rule.endsWith("hostClaimingScriptTarget")).length,
        unresolved: findings.filter((finding) => finding.rule.endsWith("unresolvedScriptTarget")).length,
    };
}

const VALID = `${JSON.stringify(
    {
        label: "A probe package",
        summary: "A package that exists to be rendered.",
        domains: [{ meta: "ai", sub: "agents-orchestration" }],
        docs: {
            overview: "What the probe is.",
            whenToUse: ["When a probe is needed."],
            quickStart: [{ intent: "Run it", lang: "bash", code: "npm run govern" }],
            configuration: [{ option: "a-file.json", note: "What the file holds." }],
            "a-custom-section": [{ surface: "a surface", lifetime: "current truth" }],
        },
    },
    null,
    4,
)}\n`;

const RENDERED = renderEntry(VALID) ?? "";

export const MANIFEST_GATE_FIXTURES: readonly GateFixture[] = [
    {
        rule: "manifest",
        kind: "manifestUnreadable",
        fires: [{ path: MANIFEST_PATH, text: "a manifest that is not JSON\n" }],
        passes: [
            { path: MANIFEST_PATH, text: VALID },
            { path: ENTRY_PATH, text: RENDERED },
        ],
    },
    {
        rule: "manifest",
        kind: "entryDrift",
        onDisk: true,
        fires: [
            { path: MANIFEST_PATH, text: VALID },
            { path: ENTRY_PATH, text: "an entry document written by hand\n" },
        ],
        heals: [
            { path: MANIFEST_PATH, text: VALID },
            { path: ENTRY_PATH, text: "an entry document written by hand\n" },
        ],
        passes: [
            { path: MANIFEST_PATH, text: VALID },
            { path: ENTRY_PATH, text: RENDERED },
        ],
    },
];

export const MANIFEST_BRANCH_FIXTURES: readonly BranchFixture[] = [
    {
        subject: "manifest.inspector",
        branch: "a script target climbing out of the package, which is a claim about a tree this package does not own",
        seed: [{ path: MANIFEST, text: CLAIMING }],
        exercise: (root) => inspecting(root),
        expect: { claims: 1, unresolved: 0 },
    },
    {
        subject: "manifest.inspector",
        branch: "a script target inside the package that does not resolve, which is the other direction of the same walk",
        seed: [{ path: MANIFEST, text: CONTAINED }],
        exercise: (root) => inspecting(root),
        expect: { claims: 0, unresolved: 1 },
    },
    {
        subject: "manifest.inspector",
        branch: "a token whose text merely contains the climb rather than taking a segment of it",
        seed: [],
        exercise: () => ({
            claims: climbsOut("tools/core/a..b/probe.ts") ? 1 : 0,
            unresolved: climbsOut("../out/probe.ts") ? 1 : 0,
        }),
        expect: { claims: 0, unresolved: 1 },
    },
    {
        subject: "manifest.generator",
        branch: "a manifest carrying every field shape, which renders the lead sections first, a custom section under its title-cased key, a code record as a fenced block, an option record as one line, and no date anywhere",
        seed: [],
        exercise: () => ({
            purpose: RENDERED.includes("## Purpose\n\nWhat the probe is."),
            custom: RENDERED.includes("## A Custom Section\n\n- **surface**: a surface\n- **lifetime**: current truth"),
            fenced: RENDERED.includes("Run it\n\n```bash\nnpm run govern\n```"),
            option: RENDERED.includes("- `a-file.json` — What the file holds."),
            domain: RENDERED.includes("- **ai** — agents-orchestration"),
            ordered: RENDERED.indexOf("## Purpose") < RENDERED.indexOf("## A Custom Section"),
        }),
        expect: { purpose: true, custom: true, fenced: true, option: true, domain: true, ordered: true },
    },
    {
        subject: "manifest.generator",
        branch: "a manifest that does not parse as an object, which renders nothing rather than an entry document describing nothing",
        seed: [],
        exercise: () => ({ rendered: renderEntry("[]") !== null || renderEntry("not json") !== null }),
        expect: { rendered: false },
    },
];
