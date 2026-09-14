import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AppError } from "../../src/errors/index.js";
import { parseWithSchema } from "../../src/validation/index.js";

describe("parseWithSchema", () => {
  it("returns typed data when schema validation succeeds", () => {
    const schema = z.object({
      email: z.string().email(),
    });

    expect(parseWithSchema(schema, { email: "dev@pulseops.local" })).toEqual({
      email: "dev@pulseops.local",
    });
  });

  it("throws an AppError with safe validation details", () => {
    const schema = z.object({
      email: z.string().email(),
    });

    expect(() => parseWithSchema(schema, { email: "not-an-email" })).toThrow(AppError);

    try {
      parseWithSchema(schema, { email: "not-an-email" });
    } catch (error) {
      expect(error).toMatchObject({
        code: "VALIDATION_ERROR",
        statusCode: 400,
      });
      expect((error as AppError).details).toEqual([
        {
          path: "email",
          message: "Invalid email address",
        },
      ]);
    }
  });
});
