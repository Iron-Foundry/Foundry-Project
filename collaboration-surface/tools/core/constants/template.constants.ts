import { surfacePath, surfacePrefix } from "../../../config/surface.config.ts";

function within(folder: string): string {
    const prefix = surfacePrefix();
    return prefix.length === 0 ? `${folder}/` : `${prefix}/${folder}/`;
}

export const TEMPLATE_ROOT = within(".claude/templates");

export const EXECUTED_TEMPLATES = ["checklist", "claim", "pattern", "agent", "layer"];

export const MANDATORY_GATES = ["tel-priority", "constrain", "ver-stop", "ter-stop"];

export const AGENT_ROOT = within(".claude/agents");

export const SKILL_ROOT = within(".claude/skills");

export const DIGEST_ROOT = within(".claude/rules");

export const INTEL_ROOT = within(".claude/intel");

export const ROLE_ROOT = `${surfacePath("roles")}/`;

export const ROLE_TEMPLATE = surfacePath("role_template");

export const FRONTMATTER_FENCE = "---";

export const IDENTITY_MARKER = "THIS AGENT IS";

export const PROTOCOL_SKILL = "collaboration-protocol";

export const SKILLS_FIELD = "skills:";

export const UNREACHABLE_REPAIR_KEYS = ["attribution"];

export const SUPPORTED_AGENT_KEYS = [
    "name",
    "description",
    "tools",
    "disallowedTools",
    "model",
    "permissionMode",
    "maxTurns",
    "skills",
    "mcpServers",
    "hooks",
    "memory",
    "background",
    "effort",
    "isolation",
    "color",
    "initialPrompt",
];
