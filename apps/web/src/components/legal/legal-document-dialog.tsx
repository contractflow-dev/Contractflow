"use client";

import { Dialog } from "@base-ui/react/dialog";
import { RiCloseLine } from "@remixicon/react";
import Link from "next/link";
import type { ReactNode } from "react";

export function LegalDocumentDialog({
  title,
  description,
  pageHref,
  open,
  onOpenChange,
  children,
}: {
  title: string;
  description: string;
  pageHref: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/55 transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none" />
        <Dialog.Viewport className="fixed inset-0 z-50 grid place-items-center p-3 sm:p-6">
          <Dialog.Popup className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xl outline-none data-ending-style:scale-[0.99] data-ending-style:opacity-0 data-starting-style:scale-[0.99] data-starting-style:opacity-0 motion-reduce:transition-none sm:max-h-[calc(100dvh-3rem)]">
            <header className="flex shrink-0 items-start justify-between gap-4 border-b px-5 py-4 sm:px-7">
              <div className="min-w-0 space-y-1">
                <Dialog.Title className="break-words text-lg font-semibold tracking-tight">
                  {title}
                </Dialog.Title>
                <Dialog.Description className="text-xs leading-5 text-muted-foreground">
                  {description}
                </Dialog.Description>
              </div>
              <Dialog.Close
                aria-label="Close policy dialog"
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <RiCloseLine className="size-5" aria-hidden="true" />
              </Dialog.Close>
            </header>
            <div
              role="region"
              aria-label={`${title} document content`}
              tabIndex={0}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-7"
            >
              {children}
            </div>
            <footer className="flex shrink-0 flex-col-reverse gap-2 border-t px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <Link
                href={pageHref}
                onClick={() => onOpenChange(false)}
                className="inline-flex min-h-10 items-center rounded-md text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Open full policy page
              </Link>
              <Dialog.Close className="inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                Close
              </Dialog.Close>
            </footer>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
