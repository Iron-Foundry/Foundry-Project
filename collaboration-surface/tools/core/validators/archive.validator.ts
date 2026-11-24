import { projectRoot } from "../../../config/surface.config.ts";
import { citationRefusal, parseCitation, resolvesCitation } from "../resolvers/reference.resolver.ts";

export const EMPTY_EXTRACTION = "none:carries-nothing-durable";

export const EXTRACTION_KIND = "changelog";

export function closureRefusal(
    closes: string,
    ref: string | null,
    agent: string | null,
    text: string | null,
    carried: string,
    kind = "",
): string | null {
    if (agent === null) return "REFUSED  --closes requires --agent <LETTER>\n";

    const judgement = kind === "judgement";

    if (judgement && ref !== null) {
        return (
            `REFUSED  ${closes} declares kind judgement on its marker, and a judgement item closes by ACKNOWLEDGER with ` +
            "NO reference — it asks for a reading, so there is nothing for a reference to point at and one supplied here " +
            "could only cite something the closer wrote, which is a claim falsifiable by nobody but its author. Close it " +
            "without --ref\n"
        );
    }

    if (!judgement && ref === null) {
        return (
            `REFUSED  ${closes} requires --ref <typed-ref>: an ARTIFACT item asks for something that can exist, so its ` +
            "closure names where the extraction landed and that reference must RESOLVE. An item asking for a READING " +
            "declares kind judgement on its marker and closes with no reference; this one does not, so either it is an " +
            "artifact item owing a reference or its kind never reached the marker where this dispatch reads it. AN " +
            `ARTIFACT CARRYING NOTHING DURABLE IS CLOSED WITH ${EMPTY_EXTRACTION} AS THE REFERENCE, which is a DECLARED ` +
            "EMPTY rather than a citation: its author is barred by the author exclusion and a peer is barred by this " +
            "requirement, so without it such an item is unclosable by construction and the only ways out are leaving it " +
            "forever or citing something that merely resolves — which satisfies the mechanism while asserting the item's " +
            "content landed somewhere it did not. The declaration is recorded in the closure line, so a party who thinks " +
            "the item DID carry something durable can contradict it\n"
        );
    }

    if (ref !== null && ref !== EMPTY_EXTRACTION) {
        const citation = parseCitation(ref);

        if (citation !== null && citation.kind !== EXTRACTION_KIND) {
            return (
                `REFUSED  ${closes} cites kind ${citation.kind}, which names a durable thing an extraction can never ` +
                "LAND IN. A closure reference is monotone with the work — true once the extraction exists and false " +
                "while it does not — so it names the ONE surface extractions land in, and a kind resolving against " +
                "anything else satisfies the resolver while carrying no information about whether anything was " +
                "extracted. THE SHARPEST CASE IS A KIND THAT RESOLVES AGAINST THE TOOL'S OWN SURFACE: it holds from " +
                "the instant the tool offers that capability, which predates every item ever written, so it cannot be " +
                `false for any item's work in either direction, ever. Cite ${EXTRACTION_KIND}:<heading>, or ` +
                `${EMPTY_EXTRACTION} where the item carries nothing durable. The sibling removal path already ` +
                "constrains to this one kind, and this one performed the same operation class while constraining " +
                "nothing\n"
            );
        }

        const refusal = citationRefusal(ref, (cited) => resolvesCitation(projectRoot(), carried, cited));
        if (refusal !== null) return refusal;
    }

    if (text === null) return `REFUSED  ${closes} has no single well-formed fence\n`;

    if (text.startsWith("NOTREADER")) {
        return (
            `${text} — an item closes by an agent in its READER set, never by its author; the ` +
            "acknowledger is not the writer, which is what stops an author clearing their own board space\n"
        );
    }

    return null;
}

export const ACKNOWLEDGED = "acknowledged";

export function extractionRefusal(
    changelog: string,
    extracted: string | null,
    carried: string,
    repoRoot = projectRoot(),
): string | null {
    if (extracted === ACKNOWLEDGED) return null;
    if (extracted === EMPTY_EXTRACTION) return null;

    if (extracted !== null && parseCitation(extracted) !== null) {
        return citationRefusal(extracted, (citation) => resolvesCitation(repoRoot, carried, citation));
    }

    if (extracted === null) {
        return (
            "REFUSED  --compress requires --extracted <heading>: removing an absorbed item without " +
            "extracting it destroys the only durable record, because the board carries no past by " +
            "construction. Rehearse it first, write the finding and its mechanism to " +
            `${changelog}, then name the heading it landed under\n`
        );
    }

    if (carried.includes(extracted)) return null;

    return (
        `REFUSED  ${changelog} carries no heading matching "${extracted}". The reference must ` +
        "RESOLVE — a declaration nobody but its author can falsify is not a record of extraction, " +
        "it is a claim that one happened\n"
    );
}
