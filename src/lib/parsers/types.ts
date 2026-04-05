export interface StatementParseMeta {
  /** How rows were produced */
  mode: "openai" | "rules" | "bank";
  /** Extra context for the user (e.g. API error, empty result) */
  detail?: string;
}
