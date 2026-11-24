import type { Inline } from "../types/segment.types.ts";

const IMPORT_TERMINATORS: ReadonlySet<string> = new Set([" ", "\t", "\r", "`", ")"]);

export function inlinesOf(line: string, lineStart: number, lineNumber: number): Inline[] {
    const out: Inline[] = [];

    for (let i = 0; i < line.length; i += 1) {
        const char = line[i] ?? "";

        if (char === "`") {
            const close = line.indexOf("`", i + 1);
            if (close === -1) continue;
            const value = line.slice(i + 1, close);
            if (value.length > 0) {
                out.push({
                    kind: "inline-code",
                    value,
                    start: lineStart + i + 1,
                    end: lineStart + close,
                    line: lineNumber,
                });
            }
            i = close;
            continue;
        }

        if (char === "]" && (line[i + 1] ?? "") === "(") {
            const close = line.indexOf(")", i + 2);
            if (close === -1) continue;
            const value = line.slice(i + 2, close);
            if (value.length > 0) {
                out.push({
                    kind: "link-target",
                    value,
                    start: lineStart + i + 2,
                    end: lineStart + close,
                    line: lineNumber,
                });
            }
            i = close;
            continue;
        }

        if (char === "@" && (i === 0 || (line[i - 1] ?? "") === " ")) {
            let cursor = i + 1;
            while (cursor < line.length) {
                if (IMPORT_TERMINATORS.has(line[cursor] ?? "")) break;
                cursor += 1;
            }
            const value = line.slice(i + 1, cursor);
            if (value.indexOf("/") !== -1) {
                out.push({
                    kind: "import-path",
                    value,
                    start: lineStart + i + 1,
                    end: lineStart + cursor,
                    line: lineNumber,
                });
            }
            i = cursor - 1;
        }
    }

    return out;
}
