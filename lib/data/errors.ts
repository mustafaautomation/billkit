export class ActionError extends Error {
  constructor(
    message: string,
    readonly code: "readonly" | "forbidden" | "not_found" | "invalid" | "unauthorized" | "limit" = "invalid",
  ) {
    super(message)
    this.name = "ActionError"
  }
}
