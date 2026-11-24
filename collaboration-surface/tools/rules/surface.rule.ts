import { config, isResolved, surfacePath, surfacePrefix } from "../../config/surface.config.ts";
import { BLOCKING_SUFFIX, VENUE_TEMPLATE } from "../core/constants/blocking.constants.ts";
import { BOARD_PATH } from "../core/constants/board.constants.ts";
import { venueFieldsFrom } from "../core/validators/venue.validator.ts";
import type { RuleContext, RuleDeclaration, RuleResult } from "../core/types/rule.types.ts";
import type { Finding } from "../core/types/segment.types.ts";

type WriteOperand = "item" | "field" | "record" | "entry" | "document";

const WRITE_ENTRYPOINT = `${surfacePath("entrypoints")}/board.entrypoint.ts`;

const FLAG_OPEN = '"--';

const FLAG_CLOSE = '"';

interface FormAssessment {
    readonly effect: "write" | "remove" | "carry";
    readonly region: string | null;
    readonly note: string;
    readonly reaches?: ToolForm;
}

function carries(note: string): FormAssessment {
    return { effect: "carry", region: null, note };
}

const ASSESSED_FORMS: Readonly<Record<string, FormAssessment>> = {
    "--agent": carries("names the calling seat and writes nothing on its own"),
    "--file": carries("names the target surface and writes nothing on its own"),
    "--help": carries("prints and writes nothing"),
    "--no-wait": carries("controls whether the call waits and writes nothing"),
    "--rehearse": carries("runs every refusal the act runs and writes nothing"),
    "--barrier": carries("takes the exclusive-write barrier and writes nothing on its own"),
    "--ref": carries("carries the extraction reference a removal refuses without"),
    "--value": carries("carries what a rewritten field now reads"),
    "--kind": carries(
        "carries which closure an item takes and is written onto its open marker, so it selects a path rather than performing a write of its own",
    ),
    "--lead": carries("carries a declared lead of an accumulator entry"),
    "--body": carries("carries an entry body"),
    "--body-file": carries("carries an entry body as one operand the caller cannot fragment"),
    "--item-file": carries("carries an item body as one operand the caller cannot fragment"),
    "--extracted": carries("names where a swept item landed"),
    "--item": {
        effect: "write",
        region: "item",
        note: "WRITES an addressed item — counted as the item operand",
        reaches: { operand: "item", member: null, venueOnly: false },
    },
    "--field": {
        effect: "write",
        region: "field",
        note: "WRITES a declared field inside the caller's own record — counted as the field operand at any member",
        reaches: { operand: "field", member: null, venueOnly: false, anyMember: true },
    },
    "--record": {
        effect: "write",
        region: "record",
        note: "WRITES the caller's own per-writer record — counted as the record operand",
        reaches: { operand: "record", member: null, venueOnly: false },
    },
    "--append": {
        effect: "write",
        region: "entry",
        note: "WRITES into an EXISTING accumulator entry, extending the declared clause its lead names — counted as the entry operand at the extension member",
        reaches: { operand: "entry", member: "extension of an existing class", venueOnly: false, slots: ["history"] },
    },
    "--extract": {
        effect: "write",
        region: "entry",
        note: "WRITES a new keyed entry into the history accumulator — counted as the entry operand at the new-class member",
        reaches: { operand: "entry", member: "new class heading", venueOnly: false, slots: ["history"] },
    },
    "--defer": {
        effect: "write",
        region: "deferral",
        note: "WRITES a clause into a venue's DEFERRED section, which the raise refuses without and which no form could write — counted as the entry operand at the deferral member",
        reaches: { operand: "entry", member: "deferral", venueOnly: true },
    },
    "--to": carries("carries the receiver a deferred clause arrives at"),
    "--retire": {
        effect: "write",
        region: "distribution",
        note: "REPLACES a planning surface's distribution declaration with a statement that it is retired, in place at that surface's own path. It performs the write its own refusals would otherwise mandate, so it discharges rather than creates a party-write obligation. It moves nothing and deletes nothing BECAUSE A PATHED CITATION FROM A FROZEN SURFACE PINS ITS TARGET against that target's own declared lifetime: the citer cannot be rewritten, so a move degrades into a disconnection that nothing reports, since the reference walk correctly skips immutable paths as citation sources. Its refusals name an open venue, a non-planning path, and a surface already retired; none requires a party write, because each names a state a party resolves by retiring something else or by not retiring at all",
    },
    "--relocate": {
        effect: "write",
        region: "venue",
        note: "MOVES a venue from the enclosing repository root to the venue root, byte-identical and verified at the destination before the source is removed — it writes no member of any surface's content, so it discharges no mandated write and is recorded here rather than paired. Its own refusals name an occupied destination, an absent source and a venue root that resolves to nothing; none of the three requires a party write, because each names a state a party resolves by relocating something else or by not relocating at all",
    },
    "--inherit": {
        effect: "write",
        region: "entry",
        note: "REPLACES the generated inherited section on a venue already raised, from the deferrals every venue sends to that invariant — it amends a block the RAISE composes rather than a member a party writes, so it discharges no party mandate. Its refusals name a venue outside the venue root, a missing inherited section and a section with no protocol banner after it, and each is a state resolved by relocating or raising rather than by a hand write",
    },
    "--roster": {
        effect: "write",
        region: "field",
        note: "RESOLVES a venue's two roster lines from the active seats, intersecting the marked set read off the surface and refusing any resolution that would return a seat to unread — the read mark itself is written by its own form and counted there, so this reaches no mandate the mark does not already reach. Its refusals name a venue outside the venue root, a venue missing a roster line and a resolution that would regress a mark; none requires a party write",
    },
    "--half": {
        effect: "write",
        region: "field",
        note: "WRITES the third cell of one conduct-roster row, resolved by column position and checked against the closed three-value set — counted as the field operand at the checkable-half member",
        reaches: { operand: "field", member: "checkable half", venueOnly: false, slots: ["conduct_roster"] },
    },
    "--observer": carries("carries what observes a rule's checkable half"),
    "--task": {
        effect: "write",
        region: "entry",
        note: "APPENDS a task row carrying every contract field the checklist template declares, derived from that template rather than transcribed — counted as the entry operand on the planning axis",
        reaches: { operand: "entry", member: null, venueOnly: false, slots: ["planning"] },
    },
    "--statement": carries("carries what a task row asks for"),
    "--model": {
        effect: "write",
        region: "entry",
        note: "RAISES a class surface from the template that seeds its root, carrying the permanent blocks and leaving the live section born present and empty — counted as the entry operand on the models axis",
        reaches: { operand: "entry", member: null, venueOnly: false, slots: ["models"] },
    },
    "--finding": {
        effect: "write",
        region: "entry",
        note: "RAISES a measured surface from the template that seeds its root, on the same derivation as its sibling — counted as the entry operand on the findings axis",
        reaches: { operand: "entry", member: null, venueOnly: false, slots: ["findings"] },
    },
    "--distribute": {
        effect: "write",
        region: "entry",
        note: "RAISES a planning surface from the template that seeds its root, on the same derivation as its two siblings — counted as the entry operand on the planning axis. THE SEED IS A SECOND DECLARATION BESIDE THE REASONING PROTOCOL rather than a re-point of it: the protocol states how a plan is EXECUTED and the planning walk derives its contract from that, while the seed states what a raised instance CARRIES PERMANENTLY and this form freezes its blocks. Two artifacts, two consumers, two declarations",
        reaches: { operand: "entry", member: null, venueOnly: false, slots: ["planning"] },
    },
    "--mark": {
        effect: "write",
        region: "field",
        note: "WRITES the calling seat's letter into the READ LEDGER on one item's own marker, which is per-recipient delivery state that dies with the item — counted as the field operand at the read-mark member, and never venue-only because an item carrying a change every seat must hold lands wherever the change is routed",
        reaches: { operand: "field", member: "read mark", venueOnly: false },
    },
    "--successor": {
        effect: "write",
        region: "field",
        note: "WRITES the successor declaration inside a venue's own declaration section, refusing an invariant the agenda does not carry as PLANNED — counted as the field operand at the successor member, and venue-only because a successor is the invariant a venue feeds",
        reaches: { operand: "field", member: "successor", venueOnly: true },
    },
    "--role": {
        effect: "write",
        region: "document",
        note: "WRITES the calling seat's own role document at the concern it names, with its section set derived from the role template — counted as the document operand on the roles axis",
        reaches: { operand: "document", member: null, venueOnly: false, slots: ["roles"] },
    },
    "--index": {
        effect: "write",
        region: "entry",
        note: "WRITES a letter-to-role binding into the identity index, allocating the shortest identity no ACTIVE or INVOKED row holds rather than taking one from the caller — an INACTIVE row is reissued in place and its previous holder's role document deleted. Counted as the entry operand at the binding member",
        reaches: { operand: "entry", member: "binding", venueOnly: false, slots: ["agent_index"] },
    },
    "--transition": {
        effect: "write",
        region: "entry",
        note: "WRITES a seat's state in the identity index — the calling seat's own by default, and a FOREIGN letter where one is named, which refuses without a warrant and records the last foreign mover beneath the row. Every invocation also runs the process probe, which moves a departed seat INACTIVE under the same foreign-transition path. Counted as the entry operand at the state-transition member",
        reaches: { operand: "entry", member: "state transition", venueOnly: false, slots: ["agent_index"] },
    },
    "--seat": carries(
        "carries the letter a transition moves, defaulting to the caller — a self-scoped transition has no case for a seat that departs without declaring, which leaves a state only that seat may change while every edge quantifying over active seats counts a party that cannot act",
    ),
    "--fixture": {
        effect: "write",
        region: "entry",
        note: "WRITES a gate fixture entry carrying BOTH halves into the declared fixture set — the fired sample the certifier refuses a kind without, and the accepted one it refuses it without equally. It takes a witness read and refuses on a concurrent change, and it supplies the placement rather than the sample CONTENT, which is the author's judgement about what violates a kind and what a correct member of its population looks like",
        reaches: { operand: "entry", member: null, venueOnly: false, anyMember: true, slots: ["fixtures"] },
    },
    "--member": {
        effect: "write",
        region: "member",
        note: "WRITES a keyed member beneath a surface's DECLARED member region and refuses a surface that declares none, so it discharges a mandate only for a surface that has opted in — which is narrower than its slot, since a slot naming a directory holds surfaces that have and have not declared one",
    },
    "--agenda": {
        effect: "write",
        region: "agenda",
        note: "WRITES a row into the AUTHORED PLAN the agenda table renders from, never into the table — the ordinal, the invariant and what a venue must establish are intent no tree holds, so they are authored, and a row written into the rendering is erased by the next run. Counted as the entry operand on the planning axis once that surface carries a declared slot",
        reaches: { operand: "entry", member: "agenda row", venueOnly: false, slots: ["agenda"] },
    },
    "--establishes": carries("carries what a planned invariant must establish"),
    "--establishes-file": carries("carries the same as one operand the caller cannot fragment"),
    "--because": carries(
        "carries why a row stands where it does, which is authored prose beside a computed value rather than the value itself",
    ),
    "--seats": carries(
        "carries the letters a raise seats as participants, which is an INTENT about who should argue rather than an observation of who is running, so it is declared and never derived from the active roster",
    ),
    "--planned": carries("carries a planned ordinal and defaults to the absent marker"),
    "--read": {
        effect: "write",
        region: "read-mark",
        note: "WRITES the caller's roster mark — counted as the field operand at the read-mark member",
        reaches: { operand: "field", member: "read mark", venueOnly: true },
    },
    "--sign": {
        effect: "write",
        region: "signature",
        note: "WRITES the caller's own sign-off row — counted as the field operand at the signature member",
        reaches: { operand: "field", member: "signature", venueOnly: true },
    },
    "--raise": carries(
        "creates a SUCCESSOR surface rather than writing content into a mandated one, so it discharges no mandate here",
    ),
    "--arrive": carries(
        "carries deferred clauses into a successor's inherited section, which no refusal names as a mandated write",
    ),
    "--retract": {
        effect: "remove",
        region: "deferral",
        note: "REMOVES one deferred clause from a venue's DEFERRED section, taking that clause by NAME as its operand — it refuses a target that declares no such section and a target that does not exist, so it removes a member rather than clearing a region, which is what makes a withdrawal reach the derivation the receiving edge joins on instead of standing only in a position",
    },
    "--repair": {
        effect: "write",
        region: "entry",
        note: "WRITES an existing accumulator entry into the shape its consumer resolves, PROMOTING a declared lead that landed mid-paragraph to the head of its own line — counted as the entry operand at the clause-repair member. It refuses an absent archive and a heading that resolves to no entry, and it moves a lead without changing a word, which is what makes it available to any caller rather than an edit that asserts a measurement in its author's name",
        reaches: { operand: "entry", member: "clause repair", venueOnly: false, slots: ["history"] },
    },
    "--compress": { effect: "remove", region: "field", note: "REMOVES a field from the caller's own record" },
    "--closes": { effect: "remove", region: "item", note: "REMOVES an addressed item the caller handled" },
    "--withdraw": { effect: "remove", region: "item", note: "REMOVES an item the caller wrote, once its request is moot" },
    "--discharge": {
        effect: "remove",
        region: "directive",
        note: "REMOVES a directive from a venue's directives section once what it asked for exists, which is a removal rather than a mandated write",
    },
};

const RETRACTABLE: Readonly<Record<string, string>> = {
    deferral:
        "a member of this region is COLLECTED WHOLESALE by a second form that takes no member argument, so an author who has withdrawn one cannot stop it travelling — the collector carries every member the region holds, and a withdrawal stated in prose beside it is invisible to the derivation the receiving edge joins on. VERIFIED at the collecting runner rather than inferred from the region's shape: the arrival computes its clause set from the whole section and reports what it carried, so a withdrawn member arrives indistinguishable from a live one and reaches a receiver who cannot tell it was retracted",
};

const ANCHORED_WRITE =
    "this mandate is LOW COST rather than discharged, and the difference is what the surface can COMPEL. A write " +
    "into authored source is usually an anchored edit, which matches a span the writer read and is refused where " +
    "the file moved since — but nothing here makes it one: a form is a mechanism a party INVOKES and the surface " +
    "therefore constrains, while an anchored edit is a mechanism a party CHOOSES, and none of these surfaces can " +
    "refuse a whole-file write. So the safe path is available and not compelled, which is the exact state where " +
    "three content losses were measured, each by a party correctly revising its own record with the unsafe " +
    "mechanism. AND THE COUNTABILITY IS THE HALF A DISCHARGE WOULD REMOVE: on a surface WITH a form, a hand write " +
    "is a DECLARED bypass and the gap stays countable because a form exists to be bypassed; on a discharged one " +
    "there is nothing to declare, so an unwitnessed write is indistinguishable from a witnessed one";

interface MandatedSurface {
    readonly slot: string;
    readonly operand: WriteOperand;
    readonly member: string | null;
    readonly refusal: string;
    readonly lowCost?: string;
}

interface WritablePair {
    readonly path: string;
    readonly operand: WriteOperand;
    readonly member: string | null;
    readonly anyMember: boolean;
}

const PARTY_WRITTEN: readonly MandatedSurface[] = [
    {
        slot: "board",
        operand: "record",
        member: null,
        refusal:
            "a record whose letter carries no board row is unaddressable, so every mechanism keyed by the letter has nothing to resolve",
    },
    {
        slot: "board",
        operand: "field",
        member: null,
        refusal:
            "a record carrying anything other than exactly its declared field set fails, so each field is a write a party owes before the record passes",
    },
    {
        slot: "board",
        operand: "item",
        member: null,
        refusal:
            "an addressed item is removable only through a span keyed to an allocated id, so the id and the fence are one mechanism rather than two options",
    },
    {
        slot: "history",
        operand: "entry",
        member: "new class heading",
        refusal:
            "a removal refuses without a reference naming where its extraction landed, and refuses again if that reference does not resolve, so a class that does not yet exist is written before the removal may run",
    },
    {
        slot: "history",
        operand: "entry",
        member: "extension of an existing class",
        refusal:
            "the same removal refusal, discharged against a class that ALREADY exists — the extraction adds a member to an entry rather than creating one, which the create form refuses by design because a second party appending into an entry asserts a measurement in its author's name",
    },
    {
        slot: "agent_index",
        operand: "entry",
        member: "binding",
        refusal:
            "a record whose letter carries no index row fails, and a letter is claimed by adding the row rather than by using it",
    },
    {
        slot: "agent_index",
        operand: "entry",
        member: "state transition",
        refusal:
            "an ACTIVE letter owning no role document fails, so the state value is an OPERAND of a refusal rather than a label — a seat whose row reads active carries a standing document mandate and the only thing that ends it is a transition, which makes the state column a mandated write on a shared surface whose binding column is written once",
    },
    {
        slot: "roles",
        operand: "document",
        member: null,
        refusal:
            "an active letter owning no role document fails, so the obligation binds at the moment the letter is allocated",
    },
    {
        slot: "planning",
        operand: "entry",
        member: null,
        refusal:
            "a converged venue no planning surface declares cannot be archived, so the absorption edge refuses until one distributes it",
    },
    {
        slot: "models",
        operand: "entry",
        member: null,
        refusal:
            "a venue refuses to converge until its class half is written here, so the exit condition requires a write and states no writer",
    },
    {
        slot: "findings",
        operand: "entry",
        member: null,
        refusal:
            "a venue refuses to converge until its measured half is written here, one row per claim, and the obligation is named beside its class half rather than separately",
    },
    {
        slot: "history",
        operand: "entry",
        member: "clause repair",
        refusal:
            "a registered walk fails an accumulator entry declaring no POPULATION or BOUNDARY clause, and no form can add one to an entry that already exists — the entry form writes clauses only from a body that carries them, and the extend form refuses a lead the entry does not already declare, so an entry that landed without them is unrepairable by every available path. VERIFIED by landing one: a body written as a single block carries those words mid-paragraph rather than at the head of a line, the walk reports both clauses absent, and the surface declares removal authority NONE so nothing retires it either. The mandate is therefore a REPAIR write rather than a first write, which is a distinct member of this class — every other entry here names content a party must supply once, and this names content a party must be able to supply AGAIN after the surface has accepted something incomplete",
    },
    {
        slot: "conduct_roster",
        operand: "field",
        member: "checkable half",
        refusal:
            "a registered walk refuses a roster row carrying no third cell, so the cell is a party write the walk requires before it passes",
        lowCost: ANCHORED_WRITE,
    },
    {
        slot: "fixtures",
        operand: "entry",
        member: "fired sample",
        refusal:
            "the certifier counts a kind with no violating sample into its open total, so the sample proving the kind FIRES is a party write the run refuses without",
        lowCost: ANCHORED_WRITE,
    },
    {
        slot: "fixtures",
        operand: "entry",
        member: "accepted sample",
        refusal:
            "the certifier counts a kind with no clearing sample into its open total, so the sample proving the kind DISCRIMINATES is a second party write and clearing the first clears nothing here",
        lowCost: ANCHORED_WRITE,
    },
];

interface ToolForm {
    readonly operand: WriteOperand;
    readonly member: string | null;
    readonly venueOnly: boolean;
    readonly anyMember?: boolean;
    readonly slots?: readonly string[];
}

const TOOL_WRITTEN: readonly ToolForm[] = Object.values(ASSESSED_FORMS)
    .map((assessment) => assessment.reaches)
    .filter((reached): reached is ToolForm => reached !== undefined);

const DELIBERATELY_UNPAIRED: Readonly<Record<string, string>> = {
    "--member":
        "the member append reaches a surface by whether that surface DECLARES a member region rather than by which slot it is, and it refuses one that declares none. A pair keyed to a slot would therefore claim reach the form does not have: a slot resolving a directory holds surfaces that have opted in and surfaces that have not, and crediting the slot would report a mandate discharged for a surface with no region. So this form is deliberately unpaired — its reach is per-surface opt-in, recorded in the form's own refusal rather than in a pair, and a mandate on a surface that HAS declared a region is cleared by reading that refusal rather than by a slot-wide claim",
};

const RECORD_FIELD_REFUSAL =
    "a venue record carrying anything other than the field set its TEMPLATE declares fails, and the closure separately holds while an active party's field is unfilled — so each declared field is a write a party owes before the venue can converge";

const SEEDED_MANDATES: readonly Omit<MandatedSurface, "slot">[] = [
    {
        operand: "field",
        member: "read mark",
        refusal:
            "positions standing while any party is marked unread fails, so the mark is a write the venue's own opening condition refuses without",
    },
    {
        operand: "field",
        member: "signature",
        refusal:
            "the closure holds while any active party is unsigned, since nobody countersigns and an unsigned party is a party that has not agreed",
    },
];

function venueMandates(template: string): Omit<MandatedSurface, "slot">[] {
    const out: Omit<MandatedSurface, "slot">[] = [...SEEDED_MANDATES];
    for (const field of venueFieldsFrom(template)) {
        out.push({ operand: "field", member: field, refusal: RECORD_FIELD_REFUSAL });
    }
    return out;
}

function immutableRoot(): string | null {
    return isResolved("surface", "venue_archive") ? surfacePath("venue_archive") : null;
}

function suffixTargets(paths: readonly string[]): string[] {
    const immutable = immutableRoot();
    const out: string[] = [];
    for (const path of paths) {
        if (!path.endsWith(BLOCKING_SUFFIX)) continue;
        if (immutable !== null && path.startsWith(`${immutable}/`)) continue;
        out.push(path);
    }
    return out;
}

function toolWritable(): WritablePair[] {
    const prefix = surfacePrefix();
    const venues = prefix.length === 0 ? BLOCKING_SUFFIX : `${prefix}/${BLOCKING_SUFFIX}`;

    const pairs: WritablePair[] = [];
    for (const written of TOOL_WRITTEN) {
        const anyMember = written.anyMember === true;

        if (written.slots !== undefined) {
            for (const slotName of written.slots) {
                if (!isResolved("surface", slotName)) continue;
                pairs.push({
                    path: surfacePath(slotName),
                    operand: written.operand,
                    member: written.member,
                    anyMember,
                });
            }
            continue;
        }

        if (!written.venueOnly) {
            pairs.push({ path: BOARD_PATH, operand: written.operand, member: written.member, anyMember });
        }
        pairs.push({ path: venues, operand: written.operand, member: written.member, anyMember });
    }
    return pairs;
}

function isFlagCharacter(char: string): boolean {
    if (char === "-") return true;
    return char >= "a" && char <= "z";
}

function flagsIn(source: string): string[] {
    const out: string[] = [];
    let from = 0;

    while (from < source.length) {
        const open = source.indexOf(FLAG_OPEN, from);
        if (open === -1) break;

        let cursor = open + 1;
        while (cursor < source.length && isFlagCharacter(source.charAt(cursor))) cursor += 1;

        const flag = source.slice(open + 1, cursor);
        const named = cursor > open + FLAG_OPEN.length;
        if (named && source.charAt(cursor) === FLAG_CLOSE && !out.includes(flag)) out.push(flag);
        from = open + FLAG_OPEN.length;
    }

    return out;
}

function inScope(paths: readonly string[], target: string): boolean {
    for (const path of paths) {
        if (path === target) return true;
        if (path.startsWith(`${target}/`)) return true;
    }
    return false;
}

function reachedByTool(
    target: string,
    operand: WriteOperand,
    member: string | null,
    writable: readonly WritablePair[],
): boolean {
    for (const pair of writable) {
        if (pair.operand !== operand) continue;
        if (!pair.anyMember && pair.member !== member) continue;
        if (target === pair.path) return true;
        if (pair.path.endsWith(BLOCKING_SUFFIX) && target.endsWith(BLOCKING_SUFFIX)) return true;
    }
    return false;
}

export const rule: RuleDeclaration = {
    stage: "meta",
    jurisdiction: "all",
    invariant:
        "every WRITE a registered mechanism refuses without is a write the tool performs, measured at the MEMBER the mechanism names rather than at the surface holding it or at the kind of write it is, so a surface reached for one member never clears a mandate on another; and a region whose members a second mechanism collects without naming one carries a form that removes a single member, so a written member stays retractable by the party who wrote it",
    extensions: [],
    kinds: ["unassessedWriteForm", "unretractableWriteRegion", "noWritePath"],
    heals: false,

    reads: [VENUE_TEMPLATE, WRITE_ENTRYPOINT],

    check(context: RuleContext): RuleResult {
        const writable = toolWritable();
        const declared = Object.keys(config.surface);

        const entrypoint = context.exists(WRITE_ENTRYPOINT) ? context.read(WRITE_ENTRYPOINT) : "";
        const liveFlags = flagsIn(entrypoint);
        const unassessed = liveFlags.filter((flag) => ASSESSED_FORMS[flag] === undefined);

        const unwritable: string[] = [];
        const lowCost: string[] = [];
        const reached: string[] = [];
        const undeclared: string[] = [];
        const outOfScope: string[] = [];
        const findings: Finding[] = [];

        const resolvedMandates: {
            from: string;
            target: string;
            operand: WriteOperand;
            member: string | null;
            refusal: string;
            lowCost?: string;
        }[] = [];

        for (const mandated of PARTY_WRITTEN) {
            if (!declared.includes(mandated.slot) || !isResolved("surface", mandated.slot)) {
                undeclared.push(mandated.slot);
                continue;
            }
            resolvedMandates.push({
                from: mandated.slot,
                target: surfacePath(mandated.slot),
                operand: mandated.operand,
                member: mandated.member,
                refusal: mandated.refusal,
                ...(mandated.lowCost === undefined ? {} : { lowCost: mandated.lowCost }),
            });
        }

        const venueTemplate = context.exists(VENUE_TEMPLATE) ? context.read(VENUE_TEMPLATE) : "";
        const suffixMandated = venueMandates(venueTemplate);

        for (const target of suffixTargets(context.paths)) {
            for (const mandated of suffixMandated) {
                resolvedMandates.push({
                    from: target,
                    target,
                    operand: mandated.operand,
                    member: mandated.member,
                    refusal: mandated.refusal,
                });
            }
        }

        for (const flag of unassessed) {
            findings.push({
                rule: "surface/unassessedWriteForm",
                path: `${surfacePath("rules")}/surface.rule.ts`,
                line: 0,
                locus: flag,
                stack: [
                    { check: "entrypoint", resolved: WRITE_ENTRYPOINT },
                    { check: "form", resolved: flag },
                    { check: "assessment", resolved: "absent" },
                ],
                actual: `${flag} is a form this entry point offers and the mandated-write walk has not assessed`,
                expected:
                    "an assessment stating whether the form performs a mandated write, and which operand and member it discharges",
                remediation: {
                    action: "declare",
                    from: flag,
                    to: null,
                    target: `${surfacePath("rules")}/surface.rule.ts`,
                    deterministic: false,
                    decide: "read the RUNNER this form calls and state what it writes, AND in the same read state whether its refusals require a write no form performs — the two answers come from one reading of one file, so they are one obligation and the second is the half that is otherwise remembered rather than mechanised. A help text states intent and a signature states what the form takes, so the assessment comes from the code rather than from the description. Then record it: a form that performs a mandated write is added to the form set at the operand and MEMBER it discharges, and one that does not is recorded with the reason it does not. THIS EXISTS BECAUSE THE FORM SET IS DATA THIS WALK CITES RATHER THAN A FACT IT DERIVES: a new form lands, the walk keeps comparing against a set that predates it, and the count stays stale with nothing reporting the lag — which is a mechanism whose own operand goes out of date silently. What IS derivable is the set of forms the entry point offers, so the walk derives that and refuses to be silent about a form nobody has classified. It cannot decide what a form DOES, which is why the assessment is a party's reading recorded as data rather than something this check infers",
                },
                healed: false,
            });
        }

        const written = new Set<string>();
        const removable = new Set<string>();

        for (const assessment of Object.values(ASSESSED_FORMS)) {
            if (assessment.region === null) continue;
            if (assessment.effect === "write") written.add(assessment.region);
            if (assessment.effect === "remove") removable.add(assessment.region);
        }

        const unretractable: string[] = [];

        for (const region of Object.keys(RETRACTABLE)) {
            if (!written.has(region)) continue;
            if (removable.has(region)) continue;

            unretractable.push(region);
            findings.push({
                rule: "surface/unretractableWriteRegion",
                path: `${surfacePath("rules")}/surface.rule.ts`,
                line: 0,
                locus: region,
                stack: [
                    { check: "region", resolved: region },
                    { check: "writeForm", resolved: "present" },
                    { check: "removeForm", resolved: "absent" },
                    { check: "classified", resolved: RETRACTABLE[region] ?? "" },
                ],
                actual: `a form writes the ${region} region, this region is classified as owing a retraction path, and no form removes a member of it`,
                expected: "a form removing one member of this region, taking the member as its operand",
                remediation: {
                    action: "declare",
                    from: region,
                    to: null,
                    target: WRITE_ENTRYPOINT,
                    deterministic: false,
                    decide: "give this region a form that removes ONE member, taking that member as its operand — a region a party can write and cannot unwrite makes every entry into it permanent at the moment of writing, so an author who withdraws a member has no path but prose, and prose is invisible to every derivation that reads the region. THE CLASSIFICATION IS DATA RATHER THAN A PROPERTY THIS WALK INFERS, because most irreversibility is DESIGN: a region whose members are evidence, a signature, or a mark of having read is correctly permanent, and a check firing there would report a defect where the permanence is the whole point. What puts a region in the registry is a verified reading of a mechanism that consumes its members WITHOUT taking a member argument — a collector, an edge, a carry — since that is what makes a withdrawal unenforceable rather than merely inconvenient. So the repair is a member-level removal and never a widening of the collector, which would let one party drop another's member",
                },
                healed: false,
            });
        }

        for (const mandated of resolvedMandates) {
            const target = mandated.target;
            const named = mandated.member === null ? mandated.operand : `${mandated.operand} ${mandated.member}`;
            const locus = `${mandated.from}:${named}`;

            if (!inScope(context.paths, target)) {
                outOfScope.push(locus);
                continue;
            }

            if (reachedByTool(target, mandated.operand, mandated.member, writable)) {
                reached.push(locus);
                continue;
            }

            if (mandated.lowCost !== undefined) lowCost.push(`${locus} — ${mandated.lowCost}`);

            unwritable.push(locus);
            findings.push({
                rule: "surface/noWritePath",
                path: target,
                line: 0,
                locus,
                stack: [
                    { check: "declared", resolved: mandated.from },
                    { check: "operand", resolved: named },
                    { check: "refusal", resolved: mandated.refusal },
                    { check: "writePath", resolved: "absent" },
                ],
                actual: `${target} is required by a refusing mechanism to carry a written ${named}, and no tool write path reaches that operand`,
                expected: null,
                remediation: {
                    action: "declare",
                    from: mandated.from,
                    to: null,
                    target,
                    deterministic: false,
                    decide: "give this surface a tool write path carrying the protections every other write takes — the writing party's own span, an allocated id, a compare-and-swap against a concurrent write, and a refusal that carries the diff. A mechanism that REQUIRES a write to a surface it cannot write is a mandate discharged BY HAND, and a hand write has no fence, no addressable id, no drain and no gate, so the protocol's own requirement forces the bypass it elsewhere forbids. The mandate and the write path arrive in different changes and only the mandate feels like the work, which is why the question is asked when a surface becomes an operand rather than when a party first attempts the operation. Until the path exists, a hand write here is DECLARED as a bypass rather than performed as an ordinary write, so the party taking it knows what it is taking and the gap stays countable",
                },
                healed: false,
            });
        }

        return {
            findings,
            healed: [],
            derivations: {
                declaredSurfaces: declared,
                toolWritable: writable,
                mandatedAndReached: reached,
                mandatedAndUnwritable: unwritable,
                lowCostByAnchoredWrite: lowCost,
                undeclaredMandates: undeclared,
                skippedAsOutOfScope: outOfScope,
                toolWrittenForms: TOOL_WRITTEN,
                formsOffered: liveFlags,
                formsUnassessed: unassessed,
                deliberatelyUnpaired: DELIBERATELY_UNPAIRED,
                pairingBound:
                    "THE WRITE-PATH REGISTRY IS DERIVED FROM THE ASSESSMENTS RATHER THAN MAINTAINED BESIDE THEM, so the two copies this walk carried are one. Each write assessment names the pair it REACHES, and the registry is those pairs collected — a form cannot be assessed as writing an operand and be invisible as a path to it, because there is no second place for the fact to live. THE COMPARATOR CAME FIRST AND FAILED, WHICH IS WHY THE COLLAPSE IS THE REPAIR RATHER THAN A PREFERENCE. The two lists spoke different vocabularies: the map named an effect and a REGION, the registry an OPERAND and a MEMBER, and a region was sometimes the operand of its pair, sometimes that pair's member, once the same word with a hyphen where the pair used a space. A check joining them reported five write forms as unpaired and every one was a naming difference — so reconciling them needed a mapping table, and that table would have been a THIRD copy of the fact the two already disagreed about. The check was deleted rather than tuned. THE CHECK ON THE COLLAPSE ITSELF is that the derived registry reproduces the hand-written one exactly: the mandate count was eight before and eight after, which is what makes the swap verified rather than hopeful. One form remains deliberately unpaired and carries its reason, because its reach is per-surface opt-in rather than per-slot and a pair would claim more than it has",
                writtenRegions: [...written],
                removableRegions: [...removable],
                retractionRegistry: Object.keys(RETRACTABLE),
                unretractableRegions: unretractable,
                retractionBound:
                    "THE REGISTRY IS THE WHOLE POPULATION AND IT IS SEEDED ONLY WITH VERIFIED MEMBERS, so an empty finding set states that every CLASSIFIED region has a removal form and states NOTHING about the regions nobody has classified. Seven of the nine regions a form writes carry no removal, and naming all seven would report a defect on the ones whose permanence is the design — an accumulator entry is the only copy of a measurement, a signature and a read mark are records of an act, and unwriting any of them would falsify the thing it records. The discriminator that puts a region in the registry is not the absence of a removal form, which is decidable and wrong; it is whether a SECOND mechanism consumes the region's members without taking a member argument, which is a reading of that mechanism's source and is why the classification is data a party writes rather than a property this walk derives. The mechanism is general and transfers to the next region by one registry line; only the registry names an instance",
                slotGranularityBound:
                    "A MANDATE IS NAMED BY SLOT AND AN OWNER ANSWERS BY SURFACE, AND THE TWO COME APART WHERE A SLOT RESOLVES A DIRECTORY. Such a slot holds several surfaces, and a form may reach one of them while another has never opted in — so crediting the slot would report the mandate discharged while a surface under it still has no path, and refusing to credit it reports no path where one exists for the surface that asked. The walk takes the second, because an uncleared mandate over-reports work and a cleared one hides it, and only the second failure is silent. THE FINDING THEREFORE MEANS: not every surface this slot resolves has a path — never that no form exists. A reader wanting the per-surface state reads the form's own refusal, which names the surfaces that declare a member region and refuses the ones that do not, and that refusal is the opt-in record rather than anything this walk holds",
                sanctionedHandWriteBound:
                    "A TOOL DECLINING AN OPERATION IS A DECISION AND DOES NOT REMOVE THE MANDATE FROM THIS POPULATION, and the discriminator is the SURFACE's writer count rather than the span's. A form that refuses to edit an existing entry — on the correct ground that a second party writing into one asserts a measurement in its author's name — leaves the operation to that author by hand. The span is single-author; the SURFACE is shared and still writable, so a concurrent appender, a witnessed read and a compare-and-swap all defend something real, and the hand write has none of them. The exemption in the rule this walk enforces is for a surface with ONE writer by construction, which the accumulator is not. So the mandate stays counted, and what the ruling changes is the REPAIR: the missing form is one an entry's own author invokes on their own entry, rather than a widening of the form that correctly refuses",
                sweepTrigger:
                    "THE UNASSESSED SET IS ALSO THE UNSWEPT SET, AND THAT IS ONE OBLIGATION RATHER THAN TWO. This walk derives the forms the entry point offers on every run, so a landing form is loud; it holds the MANDATES as data, so a landing REFUSAL is silent, and nothing derives refusals because deciding which of them REQUIRES A PARTY WRITE is a reading rather than a scan. The gap that leaves is not the reading — it is REMEMBERING that the reading is owed, which is discipline and decays. A separate swept-at marker would close it and would be a second registry over the same forms, disagreeing with the first the moment either moved, which is the defect this walk exists inside. So the two readings are COLLAPSED: assessing a form means reading its runner for what it writes AND for what its refusals require, in the same pass, because both answers come from the same read of the same file. A form that lands unassessed is therefore reported as unswept by construction, with no marker to maintain and no second copy to drift. WHAT THIS DOES NOT CLAIM: that a refusal landing on an ALREADY-ASSESSED form is caught. That case has no observable — a runner gains a refusal with no change to the offered set — and it is stated here rather than hidden, because a trigger that covers most of a condition reads as covering all of it",
                formAssessmentBound:
                    "the forms this entry point OFFERS are derived from its own source on every run; what each form DOES is a party's reading of its runner, recorded as data. So a form landing is loud rather than silent — the walk names it as unassessed until somebody opens the runner — while the walk still cannot decide whether a form discharges a mandate, which is a semantic claim no scan makes. The half that was going stale invisibly is now the half that is derived",
                regionRefusalBound:
                    "A REFUSAL NAMING AN ABSENT REGION IS NOT A MANDATED WRITE, AND THIS IS RECORDED BECAUSE THE LETTER OF THIS WALK INVARIANT SAYS OTHERWISE. Several forms append a member beneath a declared region and refuse a surface that declares none, which reads exactly like a write the form depends on and never performs. Three were tested and none survived. One refusal states plainly that the absent region is a DECISION — a surface takes the form by declaring the region, and until it does its members are deliberately hand-written, so a reader meets a choice rather than a gap; registering that would report the design as a defect. Another is a BOUNDARY guard rather than a demand: it refuses because the surface first half belongs to a party outside the seat set, so the form stays inside the table, and the region it names has existed since the surface was authored. THE DISCRIMINATOR IS WHETHER ANY PARTY IS EVER IN THE STATE THE REFUSAL DESCRIBES, needing to perform that write — not whether the refusal mentions an absence. A mandate whose population is one surface that has satisfied it since it was created is a check that can never discriminate, and a mandate whose absence is a declared choice is a check that punishes the choice. So this walk holds MEMBER writes only, and the region-shaped refusals are excluded by verification rather than by oversight",
                undeclaredMandateBound:
                    "the undeclared-mandate field above reports a mandate THIS WALK NAMES whose slot does not resolve, and it can never report a mandate whose surface has no slot at all — those are invisible to it by construction rather than absent, so an empty value states that every mandate this walk holds resolves and states NOTHING about completeness. The two surfaces that were outside the population are now inside it because the parameter surface DECLARED them rather than because this walk widened, which is the only order that keeps the bound honest: a check inventing a slot to reach a mandate is a check extending its own jurisdiction to improve its own number, so the walk names what it cannot see and the surface that owns naming decides whether to name it",
                venueMembersDerivedFrom: context.exists(VENUE_TEMPLATE)
                    ? VENUE_TEMPLATE
                    : "ABSENT — no venue template resolves, so the per-party field members reduce to the two the roster and the sign-off block mandate and no record field is counted",
                venueMembers: suffixMandated.map((mandated) => mandated.member),
                range: "the population is the (declared surface, write operand, MEMBER) triples a refusing mechanism requires, so a surface appears once per member and clearing one clears only that one; a mandate naming a surface the configuration never declared is outside it, and a surface the pipeline writes rather than a party is not a member. THE MEMBER IS THE GRANULARITY BECAUSE THE KIND IS NOT WHAT A REFUSAL NAMES: a closure holding on several per-party fields, where the tool writes some of them, is a surface whose kind reads as reached and whose remaining members are still hand writes — so a walk comparing kinds reports one finding where several stand and credits the tool for a path it does not have, which is the locally-true claim composing into a false global one. A mandate whose member is unnamed is the whole kind and matches only a tool form that is equally unnamed. The form set the tool performs is verified DATA read from its own entry point rather than a property inferred, so a new form is one entry here, and a form the tool exposes only on one surface class is scoped rather than credited everywhere. THE VENUE MEMBER SET IS DERIVED FROM THE VENUE TEMPLATE rather than listed here, because the walk that MANDATES those writes derives its record schema from that same template — a member list written here would be a second copy of one contract with nothing keeping the two equal, and the copy would go stale the first time a field is added to the template, reporting full coverage over a field no mandate here knows about. Two members are seeded rather than derived and they are the ones the template cannot supply: the roster mark and the sign-off row are venue writes that are not record fields. A surface the configuration names by SUFFIX rather than by slot is resolved from the run's own path set, so a mandate on it is counted per live instance rather than once — which is why such a locus carries its path where a slot-resolved one carries its slot name. An instance under the declared IMMUTABLE root is outside the population, because a mandated write with no path is the correct terminal state where no write will ever come rather than a defect; that root is DERIVED from the configuration here rather than restated, so this walk and every other one excluding it cannot go out of step",
            },
        };
    },
};
