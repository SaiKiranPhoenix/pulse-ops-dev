export type Brand<TValue, TBrand extends string> = TValue & { readonly __brand: TBrand };

export type ProjectId = Brand<string, "ProjectId">;
export type UserId = Brand<string, "UserId">;
export type RequestId = Brand<string, "RequestId">;
export type CorrelationId = Brand<string, "CorrelationId">;
