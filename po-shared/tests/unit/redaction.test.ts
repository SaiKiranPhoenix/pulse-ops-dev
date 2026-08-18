import { describe, expect, it } from "vitest";
import { redact, redactedValue, redactString } from "../../src/security/index.js";

describe("redaction", () => {
  it("redacts sensitive object keys recursively", () => {
    const result = redact({
      userId: "user_123",
      password: "demo",
      nested: {
        authorization: "demo",
      },
      headers: {
        "x-api-key": "demo",
      },
    });

    expect(result).toEqual({
      userId: "user_123",
      password: redactedValue,
      nested: {
        authorization: redactedValue,
      },
      headers: {
        "x-api-key": redactedValue,
      },
    });
  });

  it("redacts credential-bearing connection strings inside text", () => {
    const connectionString = [
      "mongodb://",
      "demo-user",
      ":",
      "demo-password",
      "@localhost:27017/pulseops",
    ].join("");
    const result = redactString(`failed to connect to ${connectionString}`);

    expect(result).toContain(redactedValue);
    expect(result).not.toContain("demo-password");
  });

  it("handles circular references safely", () => {
    const input: Record<string, unknown> = { name: "root" };
    input.self = input;

    expect(redact(input)).toEqual({
      name: "root",
      self: "[Circular]",
    });
  });
});
