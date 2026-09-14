export type ApiSuccessResponse<TData> = {
  readonly data: TData;
  readonly requestId: string;
};

export type ApiErrorResponse = {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: unknown;
  };
  readonly requestId: string;
};

export type ApiResponse<TData> = ApiSuccessResponse<TData> | ApiErrorResponse;
