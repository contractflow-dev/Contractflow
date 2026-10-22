"use client";

import { RiCloseLine } from "@remixicon/react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Separator } from "@workspace/ui/components/separator";
import { cn } from "@/lib/utils";

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100dvh-1.5rem)] grid-rows-[auto_auto_minmax(0,1fr)_auto_auto] gap-0 overflow-hidden p-0 sm:max-h-[calc(100dvh-3rem)] sm:max-w-2xl"
      >
        <DialogHeader className="flex-row items-start justify-between gap-4 px-5 py-4 sm:px-7">
          <div className="min-w-0 space-y-1">
            <DialogTitle className="break-words text-lg font-semibold tracking-tight">
              {title}
            </DialogTitle>
            <DialogDescription className="text-xs leading-5">
              {description}
            </DialogDescription>
          </div>
          <DialogClose
            render={
              <Button
                variant="ghost"
                size="icon-lg"
                aria-label="Close policy dialog"
              />
            }
          >
            <RiCloseLine aria-hidden="true" />
          </DialogClose>
        </DialogHeader>
        <Separator />
        <div
          role="region"
          aria-label={`${title} document content`}
          tabIndex={0}
          className="min-h-0 overflow-y-auto overscroll-contain px-5 py-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-7"
        >
          {children}
        </div>
        <Separator />
        <DialogFooter className="px-5 py-3 sm:items-center sm:justify-between sm:px-7">
          <Link
            href={pageHref}
            onClick={() => onOpenChange(false)}
            className={cn(buttonVariants({ variant: "link" }), "h-10 px-0")}
          >
            Open full policy page
          </Link>
          <DialogClose render={<Button className="h-10 px-4" />}>
            Close
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
