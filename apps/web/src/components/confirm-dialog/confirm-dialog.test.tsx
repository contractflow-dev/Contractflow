import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./confirm-dialog";

const mocks = vi.hoisted(() => ({
  onOpenChange: null as ((open: boolean) => void) | null,
}));

// The real dialog renders into a portal, which a static render leaves empty.
vi.mock("@workspace/ui/components/alert-dialog", () => ({
  AlertDialog: ({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: ReactNode;
  }) => {
    mocks.onOpenChange = onOpenChange;
    return open ? <div role="alertdialog">{children}</div> : null;
  },
  AlertDialogContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogHeader: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogFooter: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogTitle: ({ children }: { children: ReactNode }) => (
    <h2>{children}</h2>
  ),
  AlertDialogDescription: ({ children }: { children: ReactNode }) => (
    <p>{children}</p>
  ),
  AlertDialogCancel: (props: ComponentProps<"button">) => (
    <button type="button" {...props} />
  ),
}));

function renderDialog(props: Partial<ComponentProps<typeof ConfirmDialog>>) {
  return renderToStaticMarkup(
    <ConfirmDialog
      open
      title="Change this member's role?"
      description="Ari Admin will change from Company Administrator to HSE Officer."
      confirmLabel="Change role"
      pendingLabel="Changing role…"
      onConfirm={vi.fn()}
      onCancel={vi.fn()}
      {...props}
    />,
  );
}

describe("ConfirmDialog", () => {
  beforeEach(() => {
    mocks.onOpenChange = null;
  });

  it("names the action, its effect, and offers cancel and confirm", () => {
    const markup = renderDialog({});

    expect(markup).toContain("Change this member&#x27;s role?");
    expect(markup).toContain("Ari Admin will change from Company Administrator");
    expect(markup).toContain(">Cancel</button>");
    expect(markup).toContain(">Change role</button>");
    expect(markup).not.toMatch(/\sdisabled=""/);
  });

  it("disables both actions and shows progress while the request runs", () => {
    const markup = renderDialog({ isPending: true });

    expect(markup).toContain("Changing role…");
    expect(markup).toContain('aria-busy="true"');
    expect(markup.match(/\sdisabled=""/g)).toHaveLength(2);
  });

  it("cancels on dismiss, but not while the request is running", () => {
    const onCancel = vi.fn();

    renderDialog({ onCancel, isPending: true });
    mocks.onOpenChange?.(false);
    expect(onCancel).not.toHaveBeenCalled();

    renderDialog({ onCancel });
    mocks.onOpenChange?.(false);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("renders nothing when closed", () => {
    expect(renderDialog({ open: false })).toBe("");
  });
});
