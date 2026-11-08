import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ECompanyStatus,
  ECompanyUserStatus,
  EContractSiteStatus,
  EContractStatus,
  EFromStatus,
  EInvitationStatus,
  EToStatus,
} from "@contractflow/contracts-schema";
import {
  ARCHIVED_STATUS,
  StatusBadge,
  effectiveInvitationStatus,
  getStatusPresentation,
} from "./status-badge";

const displayedStatuses = [
  ...Object.values(EContractStatus),
  ...Object.values(EFromStatus),
  ...Object.values(EToStatus),
  ...Object.values(EInvitationStatus),
  ...Object.values(ECompanyUserStatus),
  ...Object.values(ECompanyStatus),
  ...Object.values(EContractSiteStatus),
  "rejected",
  ARCHIVED_STATUS,
];

describe("getStatusPresentation", () => {
  it.each(displayedStatuses)(
    "gives %s a readable label, never the raw value",
    (status) => {
      const { label } = getStatusPresentation(status);
      expect(label).not.toContain("_");
      expect(label.charAt(0)).toBe(label.charAt(0).toUpperCase());
    },
  );

  it("maps statuses to semantic tones", () => {
    expect(getStatusPresentation(EContractStatus.ACTIVE)).toEqual({
      label: "Active",
      tone: "success",
    });
    expect(getStatusPresentation(EContractStatus.DRAFT).tone).toBe("neutral");
    expect(getStatusPresentation(EContractStatus.SUSPENDED).tone).toBe(
      "warning",
    );
    expect(getStatusPresentation(EContractStatus.COMPLETED).tone).toBe("info");
    expect(getStatusPresentation(EToStatus.CANCELLED).tone).toBe("danger");
    expect(getStatusPresentation(EToStatus.UNDER_REVIEW)).toEqual({
      label: "Under review",
      tone: "warning",
    });
    expect(getStatusPresentation(EInvitationStatus.PENDING).tone).toBe(
      "warning",
    );
    expect(getStatusPresentation(EInvitationStatus.DECLINED).tone).toBe(
      "danger",
    );
    expect(getStatusPresentation(EInvitationStatus.REVOKED).tone).toBe(
      "inactive",
    );
    expect(getStatusPresentation(ECompanyUserStatus.INACTIVE).tone).toBe(
      "inactive",
    );
    expect(getStatusPresentation(EContractSiteStatus.PLANNED).tone).toBe(
      "neutral",
    );
    expect(getStatusPresentation(ARCHIVED_STATUS)).toEqual({
      label: "Archived",
      tone: "inactive",
    });
  });

  it("keeps distinct statuses distinguishable by label", () => {
    const labels = new Set(
      displayedStatuses.map((status) => getStatusPresentation(status).label),
    );
    expect(labels.size).toBe(new Set(displayedStatuses).size);
  });

  it("handles unknown, empty, and differently cased values safely", () => {
    expect(getStatusPresentation("on_hold")).toEqual({
      label: "On hold",
      tone: "neutral",
    });
    expect(getStatusPresentation(undefined)).toEqual({
      label: "Unknown",
      tone: "neutral",
    });
    expect(getStatusPresentation("")).toEqual({
      label: "Unknown",
      tone: "neutral",
    });
    expect(getStatusPresentation("ACTIVE").label).toBe("Active");
    expect(getStatusPresentation("toString")).toEqual({
      label: "toString",
      tone: "neutral",
    });
  });
});

describe("effectiveInvitationStatus", () => {
  const now = new Date("2026-06-10T12:00:00.000Z");

  it("shows a pending invitation past its expiry as expired", () => {
    expect(
      effectiveInvitationStatus("pending", "2026-06-10T11:59:00.000Z", now),
    ).toBe("expired");
  });

  it("leaves current and settled invitations unchanged", () => {
    expect(
      effectiveInvitationStatus("pending", "2026-06-11T00:00:00.000Z", now),
    ).toBe("pending");
    expect(
      effectiveInvitationStatus("accepted", "2026-06-01T00:00:00.000Z", now),
    ).toBe("accepted");
    expect(effectiveInvitationStatus("pending", null, now)).toBe("pending");
    expect(effectiveInvitationStatus("pending", "not a date", now)).toBe(
      "pending",
    );
  });
});

describe("StatusBadge", () => {
  it("renders the label with the tone's badge variant", () => {
    const markup = renderToStaticMarkup(
      <StatusBadge status={EContractStatus.ACTIVE} />,
    );
    expect(markup).toContain(">Active</span>");
    expect(markup).toContain('data-tone="success"');
    expect(markup).toContain("bg-success-soft");
    expect(markup).toContain("text-success-soft-foreground");
  });

  it("uses the destructive and outline variants for danger and inactive", () => {
    expect(
      renderToStaticMarkup(<StatusBadge status={EInvitationStatus.DECLINED} />),
    ).toContain("text-destructive");
    expect(
      renderToStaticMarkup(<StatusBadge status={ARCHIVED_STATUS} />),
    ).toContain("border-border");
  });

  it("renders an unknown status readably in the neutral tone", () => {
    const markup = renderToStaticMarkup(<StatusBadge status="awaiting_docs" />);
    expect(markup).toContain(">Awaiting docs</span>");
    expect(markup).toContain('data-tone="neutral"');
    expect(markup).toContain("bg-secondary");
  });
});
