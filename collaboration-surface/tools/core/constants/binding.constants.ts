import { slotText, surfacePath, surfacePrefix } from "../../../config/surface.config.ts";
import { AGENT_ROOT, TEMPLATE_ROOT } from "./template.constants.ts";

export const BINDING_PATH = surfacePath("binding");

export const BINDING_SOURCE =
    surfacePrefix().length === 0
        ? slotText("project", "runtime_adapter")
        : `${surfacePrefix()}/${slotText("project", "runtime_adapter")}`;

export const SLOT_CONSUMERS = [TEMPLATE_ROOT, AGENT_ROOT];

export const RESOLUTION_STATES = ["RESOLVED", "ABSENT", "DEFERRED"];
