import { HttpException } from "@nestjs/common";
import {
  type ServiceError,
  type ErrorCode,
  ERROR_CODE_STATUS_MAP,
} from "../types";
import { STATUS_TO_CODE_MAP } from "../maps";

/**
 * Converts an HttpException or ServiceError-like object into a ServiceError.
 * Used internally by @MapResult to normalize errors before mapping.
 */
export function toServiceError(
  error: HttpException | ServiceError,
): ServiceError {
  // Already a ServiceError shape (e.g. from typed SDK result)
  if ("code" in error && "status" in error && "message" in error) {
    if (
      typeof (error as ServiceError).code === "string" &&
      typeof (error as ServiceError).status === "number"
    ) {
      return error as ServiceError;
    }
  }

  if (error instanceof HttpException) {
    const status = error.getStatus();
    const rawResponse = error.getResponse();
    const responseObj =
      typeof rawResponse === "object" && rawResponse !== null
        ? (rawResponse as Record<string, unknown>)
        : {
            message:
              typeof rawResponse === "string" ? rawResponse : "Unknown error",
          };

    // Use the code from the response if it's present (ServiceException sets this)
    const code: string =
      typeof responseObj.code === "string"
        ? responseObj.code
        : (STATUS_TO_CODE_MAP[status] ?? "INTERNAL_SERVER_ERROR");

    const resolvedStatus =
      (ERROR_CODE_STATUS_MAP as Record<string, number>)[code] ?? status;

    return {
      code,
      status: resolvedStatus,
      message: (responseObj.message as string) ?? "Unknown error",
      provider: responseObj.provider as string | undefined,
      response: responseObj.response ?? responseObj,
    };
  }

  return {
    code: "INTERNAL_SERVER_ERROR",
    status: 500,
    message: "Unknown error",
  };
}
