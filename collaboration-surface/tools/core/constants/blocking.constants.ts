import { surfacePath, surfacePrefix } from "../../../config/surface.config.ts";

const PLAN_FILE = "config/agenda.config.ts";

export const BLOCKING_SUFFIX = ".blocking.md";

export const VENUE_TEMPLATE = surfacePath("venue_template");

export const VENUE_ARCHIVE = `${surfacePath("venue_archive")}/`;

export const AGENDA = surfacePath("agenda");

export const AGENDA_PLAN = surfacePrefix().length === 0 ? PLAN_FILE : `${surfacePrefix()}/${PLAN_FILE}`;

export const RESOLUTION_HEADING = "## Exit condition";

export const UNREAD_MARKER = "NOT-READ:";

export const POSITION_MARKER = "Position ";
