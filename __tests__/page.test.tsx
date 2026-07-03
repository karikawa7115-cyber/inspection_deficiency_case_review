import { describe, it, expect } from "vitest";

import InspectionPage from "../app/inspection/page";
import HomePage from "../app/page";

describe("workspace-ui-kit smoke tests", () => {
  it("home page module exports a component", () => {
    expect(HomePage).toBeTypeOf("function");
  });

  it("inspection page module exports a component", () => {
    expect(InspectionPage).toBeTypeOf("function");
  });
});
