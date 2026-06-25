export function normalizeError(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message || "Unknown error";

    if (msg.includes("ENOENT") || msg.includes("EACCES")) {
      return "File access error. Please check service account credentials path.";
    }
    if (msg.includes("401") || msg.includes("403") || msg.includes("Unauthorized")) {
      return "Authentication failed. Please verify your credentials and permissions.";
    }
    if (msg.includes("429") || msg.includes("Rate limit")) {
      return "Rate limit exceeded. Please wait before making more requests.";
    }

    return msg;
  }

  if (typeof error === "string") {
    return error;
  }

  return "An unexpected error occurred.";
}

export class ToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolError";
  }
}

export function toolError(message: string): ToolError {
  return new ToolError(message);
}
