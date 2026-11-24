import {
    FRONTMATTER_FENCE,
    IDENTITY_MARKER,
    PROTOCOL_SKILL,
    SKILLS_FIELD,
    SUPPORTED_AGENT_KEYS,
    UNREACHABLE_REPAIR_KEYS,
} from "../constants/template.constants.ts";
import type { Finding } from "../types/segment.types.ts";

export function participationOf(source: string): string | null {
    const body = bodyOf(source);
    const at = body.indexOf(IDENTITY_MARKER);
    if (at === -1) return null;

    let rest = body.slice(at + IDENTITY_MARKER.length).trimStart();
    while (rest.startsWith("*")) rest = rest.slice(1);
    let out = "";

    for (const char of rest) {
        const word = (char >= "a" && char <= "z") || (char >= "A" && char <= "Z");
        if (!word) break;
        out += char;
    }

    return out;
}

export function bodyOf(source: string): string {
    const lines = source.split("\n");
    if ((lines[0] ?? "").trim() !== FRONTMATTER_FENCE) return source;

    for (let index = 1; index < lines.length; index += 1) {
        if ((lines[index] ?? "").trim() !== FRONTMATTER_FENCE) continue;
        return lines.slice(index + 1).join("\n");
    }

    return "";
}

function frontmatterKeys(source: string): string[] {
    const lines = source.split("\n");
    if ((lines[0] ?? "").trim() !== FRONTMATTER_FENCE) return [];

    const out: string[] = [];
    for (let index = 1; index < lines.length; index += 1) {
        const line = lines[index] ?? "";
        if (line.trim() === FRONTMATTER_FENCE) break;
        if (line.startsWith(" ") || line.startsWith("-")) continue;

        const colon = line.indexOf(":");
        if (colon <= 0) continue;
        out.push(line.slice(0, colon).trim());
    }
    return out;
}

export function preloadedSkills(source: string): string[] {
    const lines = source.split("\n");
    const out: string[] = [];

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] ?? "";
        if (index > 0 && line.trim() === FRONTMATTER_FENCE) break;
        if (!line.startsWith(SKILLS_FIELD)) continue;

        const inline = line.slice(SKILLS_FIELD.length).trim();
        if (inline.length > 0) {
            const stripped = inline.startsWith("[") ? inline.slice(1, inline.lastIndexOf("]")) : inline;
            for (const part of stripped.split(",")) {
                const value = part.trim();
                if (value.length > 0) out.push(value);
            }
            continue;
        }

        for (let scan = index + 1; scan < lines.length; scan += 1) {
            const entry = (lines[scan] ?? "").trim();
            if (!entry.startsWith("- ")) break;
            out.push(entry.slice(2).trim());
        }
    }

    return out;
}

export function checkKeys(
    name: string,
    source: string,
    build: (kind: string, locus: string, actual: string, expected: string, decide: string) => Finding,
    findings: Finding[],
): void {
    for (const key of frontmatterKeys(source)) {
        if (SUPPORTED_AGENT_KEYS.includes(key)) continue;
        if (UNREACHABLE_REPAIR_KEYS.includes(key)) continue;
        findings.push(
            build(
                "undeliveredKey",
                key,
                `${name} declares "${key}", which the harness does not recognise`,
                "a key the harness reads, or the same content stated in the delivered body",
                "the harness parses this frontmatter against a fixed set of keys and ignores every other one, so an unrecognised key is read by its author and by an auditor and DELIVERED TO NOBODY. That gives it two readerships and no consumer, which is the condition under which a declaration drifts against the body beside it and against every ruling above it with nothing breaking when it is wrong. Content the agent must act on belongs in the BODY, which is its system prompt; content the harness must act on belongs in a key the harness reads. A third category exists only as decoration that reads like configuration",
            ),
        );
    }
}

export function checkIdentity(
    name: string,
    source: string,
    letters: ReadonlySet<string>,
    skills: ReadonlySet<string>,
    build: (kind: string, locus: string, actual: string, expected: string, decide: string) => Finding,
    findings: Finding[],
): void {
    const declared = participationOf(source);

    if (declared === null || declared.length === 0) {
        findings.push(
            build(
                "participationUndeclared",
                name,
                `${name} states no "${IDENTITY_MARKER}" line in its delivered body`,
                `"${IDENTITY_MARKER} <LETTER>" in the body, which is the agent's system prompt`,
                "every board mechanism is keyed by an agent's letter — the fence, the reader set, the snapshot diff, the closure check — so an agent writing without one is unaddressable, uncloseable and cannot be told what was written to it. The declaration is read from the BODY because the body IS the delivered system prompt, while an unrecognised frontmatter key reaches nobody: a letter declared in such a field is one the agent never receives, so a check reading that field would measure the artifact while the mechanism stood inert",
            ),
        );
        return;
    }

    if (!letters.has(declared)) {
        findings.push(
            build(
                "participationUnindexed",
                declared,
                `${name} writes under ${declared}, which the agent index does not bind`,
                `${declared} carrying an index row before its first write`,
                "a letter is claimed by adding the index row, never by declaring it in a spec — an agent writing under a letter nothing resolves is unaddressable and uncloseable, and every citation later written against it resolves to nothing too",
            ),
        );
    }

    for (const declared of preloadedSkills(source)) {
        if (skills.has(declared)) continue;
        findings.push(
            build(
                "skillDoesNotResolve",
                declared,
                `${name} preloads ${declared}, which resolves to no skill in the tree`,
                `${declared} existing as a skill the harness can load`,
                "a preloaded skill that does not resolve is skipped with a warning to a debug log nobody reads, so the spec declares the channel, the check passes on the declaration, and the agent receives nothing. The check binds EVERY declared entry rather than one named skill, because a guard written for one instance leaves a typo in every other entry silent — and the reasoning that justifies the guard is identical for all of them, which is exactly the shape of a rule that names an instance instead of the construct",
            ),
        );
    }

    if (!frontmatterKeys(source).includes(SKILLS_FIELD.slice(0, -1)) || !source.includes(PROTOCOL_SKILL)) {
        findings.push(
            build(
                "protocolNotPreloaded",
                PROTOCOL_SKILL,
                `${name} writes under ${declared} without naming ${PROTOCOL_SKILL} in its ${SKILLS_FIELD} field`,
                `${SKILLS_FIELD} naming ${PROTOCOL_SKILL}, whose full content is injected at startup`,
                "an agent holding a letter writes to a shared surface, and every rule governing that surface — one writer per record, the fence, extraction before removal, the handler removes the item — reaches it through NO other channel. The frontmatter it is declared in is discarded, the body is the agent's own and carries no shared protocol, and the board itself is never delivered. A preloaded skill is injected WHOLE at startup and is per-agent, which makes it the only surface that is both delivered and shared — so this is the one check in the participation chain that observes a channel the agent actually receives rather than a declaration about it",
            ),
        );
    }

    if (!name.includes(`.${declared}.`)) {
        findings.push(
            build(
                "letterNotInName",
                declared,
                `${name} does not carry ${declared} in its filename`,
                `<subject>.${declared}.md, with a name field ending -${declared}`,
                "the harness resolves an agent by its name field and never by its filename, so this check is about THIS TREE'S citation graph rather than about how the agent is invoked. Every board item, index row and changelog line that ever named this letter is resolved by a reader searching the tree, and a filename carrying the letter is what makes that search terminate — carry it in a field alone and a rename disconnects those citations silently, because nothing here resolves them at runtime to fail loudly",
            ),
        );
    }
}
