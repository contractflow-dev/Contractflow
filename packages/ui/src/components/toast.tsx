"use client"

import { Toast } from "@base-ui/react/toast"
import {
  RiCheckboxCircleFill,
  RiCloseLine,
  RiErrorWarningFill,
  RiInformationFill,
  RiLoader4Line,
} from "@remixicon/react"
import { cn } from "cn"

/**
 * Toast notifications built on Base UI's Toast. The viewport is a labelled
 * "Notifications" landmark (F6 moves focus to it) and announces each toast:
 * politely by default, assertively for `priority: "high"` (used for errors).
 *
 * `type` selects the icon and colour: "success", "error", "loading", or any
 * other value for neutral information.
 */
const ToastProvider = Toast.Provider
const createToastManager = Toast.createToastManager

const icons = {
  success: RiCheckboxCircleFill,
  error: RiErrorWarningFill,
  loading: RiLoader4Line,
} as const

function ToastIcon({ type }: { type: string | undefined }) {
  const Icon =
    type && type in icons ? icons[type as keyof typeof icons] : RiInformationFill
  return (
    <Icon
      aria-hidden="true"
      data-slot="toast-icon"
      className={cn(
        "mt-0.5 size-4 shrink-0",
        type === "success" && "text-success",
        type === "error" && "text-destructive",
        type === "loading" && "animate-spin text-muted-foreground",
        !(type && type in icons) && "text-info"
      )}
    />
  )
}

function Toaster({ className }: { className?: string }) {
  const { toasts } = Toast.useToastManager()
  return (
    <Toast.Portal>
      <Toast.Viewport
        data-slot="toast-viewport"
        className={cn(
          "fixed inset-x-4 bottom-4 z-100 flex flex-col-reverse gap-2 outline-none sm:start-auto sm:end-4 sm:w-96",
          className
        )}
      >
        {toasts.map((toast) => (
          <Toast.Root
            key={toast.id}
            toast={toast}
            data-slot="toast"
            className={cn(
              "flex w-full items-start gap-3 rounded-2xl border bg-popover p-3 pe-2 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/5 transition-[opacity,transform] duration-200 select-none dark:ring-foreground/10",
              "translate-x-(--toast-swipe-movement-x) translate-y-(--toast-swipe-movement-y)",
              "data-starting-style:translate-y-2 data-starting-style:opacity-0 data-ending-style:opacity-0 data-limited:hidden",
              "data-[type=error]:border-destructive/30"
            )}
          >
            <ToastIcon type={toast.type} />
            <Toast.Content className="min-w-0 flex-1 space-y-0.5">
              <Toast.Title
                data-slot="toast-title"
                className="leading-snug font-medium break-words"
              />
              <Toast.Description
                data-slot="toast-description"
                className="leading-snug break-words text-muted-foreground"
              />
            </Toast.Content>
            <Toast.Close
              data-slot="toast-close"
              aria-label="Dismiss notification"
              className="-mt-0.5 grid size-6 shrink-0 place-items-center rounded-xl text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
            >
              <RiCloseLine className="size-4" aria-hidden="true" />
            </Toast.Close>
          </Toast.Root>
        ))}
      </Toast.Viewport>
    </Toast.Portal>
  )
}

export { Toaster, ToastProvider, createToastManager }
