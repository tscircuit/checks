import type { SourceComponentBase } from "circuit-json"

// circuit-json does not currently export a standalone source-component ID type.
export type SourceComponentId = SourceComponentBase["source_component_id"]
