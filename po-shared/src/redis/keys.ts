export function toApiKeyCacheKey(keyHash: string): string {
  return `apiKey:${keyHash}`;
}
