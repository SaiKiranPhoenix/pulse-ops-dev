import type { ErrorCode, ErrorDetails } from "../../errors/index.js";

export type ApiSuccessResponse<TData> = {
  readonly data: TData;
  readonly requestId: string;
};

export type ApiErrorResponse = {
  readonly error: {
    readonly code: ErrorCode;
    readonly message: string;
    readonly details?: ErrorDetails;
  };
  readonly requestId: string;
};

export type ApiResponse<TData> = ApiSuccessResponse<TData> | ApiErrorResponse;

export function successResponse<TData>(data: TData, requestId: string): ApiSuccessResponse<TData> {
  return { data, requestId };
}

export function errorResponse(args: {
  code: ErrorCode;
  message: string;
  requestId: string;
  details?: ErrorDetails;
}): ApiErrorResponse {
  return {
    error: {
      code: args.code,
      message: args.message,
      ...(args.details === undefined ? {} : { details: args.details }),
    },
    requestId: args.requestId,
  };
}
