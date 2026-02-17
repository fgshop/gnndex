type ApiLikeError = {
  code?: string;
  message?: string | string[];
  error?: string;
  statusCode?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

export function getApiErrorMessage(error: unknown, fallback = "Request failed"): string {
  if (!error) {
    return fallback;
  }

  if (typeof error === "string") {
    return error;
  }

  if (isRecord(error)) {
    const err = error as ApiLikeError;
    if (Array.isArray(err.message) && err.message.length > 0) {
      return err.message.join(", ");
    }
    if (typeof err.message === "string" && err.message.trim().length > 0) {
      return err.message;
    }
    if (typeof err.error === "string" && err.error.trim().length > 0) {
      return err.error;
    }
    if (typeof err.code === "string" && err.code.trim().length > 0) {
      return err.code;
    }
  }

  return fallback;
}
