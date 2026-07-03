import { describe, it, expect } from "vitest";

import {
  applyDpApproval,
  applySupervisorApproval,
  canDpApprove,
  canSupervisorApprove,
  isFollowUpOutputLocked,
  requiresDpApproval,
} from "@/lib/inspection/approval";

describe("requiresDpApproval", () => {
  it("Handover と Checklist のみ DP 承認が必要", () => {
    expect(requiresDpApproval("handover_note")).toBe(true);
    expect(requiresDpApproval("internal_audit_checklist")).toBe(true);
    expect(requiresDpApproval("review_comment")).toBe(false);
    expect(requiresDpApproval("vessel_revision_en")).toBe(false);
  });
});

describe("supervisor approval flow", () => {
  it("監督のみタブは draft → Approved へ", () => {
    expect(canSupervisorApprove("draft")).toBe(true);
    expect(canSupervisorApprove("supervisor_review")).toBe(false);

    const result = applySupervisorApproval("vessel_revision_en");
    expect(result.status).toBe("dp_approved");
    expect(result.approval.role).toBe("supervisor");
  });

  it("DP 必須タブは draft → Awaiting DP へ", () => {
    const result = applySupervisorApproval("handover_note");
    expect(result.status).toBe("supervisor_review");
    expect(canDpApprove("supervisor_review", "handover_note")).toBe(true);
    expect(canDpApprove("draft", "handover_note")).toBe(false);
  });
});

describe("dp approval flow", () => {
  it("Awaiting DP から Approved へ", () => {
    const result = applyDpApproval();
    expect(result.status).toBe("dp_approved");
    expect(result.approval.role).toBe("dp");
    expect(isFollowUpOutputLocked("dp_approved")).toBe(true);
    expect(isFollowUpOutputLocked("supervisor_review")).toBe(true);
    expect(isFollowUpOutputLocked("draft")).toBe(false);
  });
});

describe("dual approval sequence", () => {
  it("Handover は監督 → DP の順で Approved", () => {
    const supervisor = applySupervisorApproval("handover_note");
    expect(supervisor.status).toBe("supervisor_review");

    const dp = applyDpApproval();
    expect(dp.status).toBe("dp_approved");
    expect(isFollowUpOutputLocked(dp.status)).toBe(true);
  });
});
