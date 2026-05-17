import { describe, expect, it } from "vitest";
import {
  getHrworksSelectorMappingTemplate,
  validateHrworksSelectorMapping,
} from "./hrworksSelectorMapping";

describe("hrworksSelectorMapping", () => {
  it("provides a complete template", () => {
    const tpl = getHrworksSelectorMappingTemplate();
    const result = validateHrworksSelectorMapping(tpl);
    expect(result.ok).toBe(true);
  });

  it("rejects incomplete mappings", () => {
    const result = validateHrworksSelectorMapping({ version: 1, purposeInput: "x" });
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/Selector fehlt/);
  });
});
