import { POSITION_MARKER, UNREAD_MARKER } from "../constants/blocking.constants.ts";
import { itemSpans } from "../resolvers/sweep.resolver.ts";

const PLACEHOLDER_OPEN = "<";

const PLACEHOLDER_CLOSE = ">";

function isAddress(char: string): boolean {
    return (char >= "A" && char <= "Z") || (char >= "0" && char <= "9");
}

function addressAt(line: string, from: number): string {
    let cursor = from;
    let value = "";

    while (cursor < line.length && isAddress(line.charAt(cursor))) {
        value += line.charAt(cursor);
        cursor += 1;
    }

    return value;
}

function positionAuthors(lines: readonly string[]): Set<string> {
    const authors = new Set<string>();

    for (const line of lines) {
        if (!line.startsWith(POSITION_MARKER)) continue;

        const address = addressAt(line, POSITION_MARKER.length);
        if (address.length === 0) continue;

        let head = "";
        for (const char of address) {
            if (char >= "0" && char <= "9") break;
            head += char;
        }

        if (head.length > 0) authors.add(head);
    }

    return authors;
}

function unreadRoster(lines: readonly string[]): Set<string> {
    const unread = new Set<string>();

    for (const line of lines) {
        if (!line.startsWith(UNREAD_MARKER)) continue;

        const tail = line.slice(UNREAD_MARKER.length);
        let mentioned = false;

        for (let index = 0; index < tail.length; index += 1) {
            const character = tail.charAt(index);

            if (character === PLACEHOLDER_OPEN) {
                mentioned = true;
                continue;
            }
            if (character === PLACEHOLDER_CLOSE) {
                mentioned = false;
                continue;
            }
            if (mentioned) continue;
            if (!isAddress(character)) continue;
            if (index > 0 && isAddress(tail.charAt(index - 1))) continue;

            unread.add(addressAt(tail, index));
        }
    }

    return unread;
}

export function unreadWhilePositionsStand(source: string): string[] {
    const lines = source.split("\n");
    if (positionAuthors(lines).size === 0 && itemSpans(source).length === 0) return [];

    return [...unreadRoster(lines)].sort();
}

export function unreadAuthors(source: string): string[] {
    const lines = source.split("\n");
    const unread = unreadRoster(lines);
    if (unread.size === 0) return [];

    const out: string[] = [];
    for (const author of positionAuthors(lines)) {
        if (unread.has(author)) out.push(author);
    }

    return out.sort();
}
