// @vitest-environment jsdom
import type { FormEvent } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DropdownMenuItem } from "@workspace/ui/components/dropdown-menu";
import {
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import {
  ActionsTableHead,
  DataTableEmpty,
  DataTableFrame,
  DataTableError,
  DataTableRowActions,
  DataTableSkeleton,
  SortableTableHead,
} from "./data-table";
import { DataTableSearch } from "./data-table-toolbar";

afterEach(cleanup);

describe("DataTableFrame", () => {
  it("is a named, semantic table with sortable and action headers", async () => {
    const onSort = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(
      <DataTableFrame label="Invoices">
        <TableHeader>
          <TableRow>
            <SortableTableHead label="Due" direction="desc" onSort={onSort} />
            <SortableTableHead
              label="Number"
              direction={null}
              onSort={vi.fn()}
            />
            <ActionsTableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>1 Jan</TableCell>
            <TableCell>INV-1</TableCell>
            <TableCell />
          </TableRow>
        </TableBody>
      </DataTableFrame>,
    );

    const table = screen.getByRole("table", { name: "Invoices" });
    const [due, number, actions] = within(table).getAllByRole("columnheader");
    expect(due.getAttribute("aria-sort")).toBe("descending");
    expect(number.getAttribute("aria-sort")).toBe("none");
    expect(actions.textContent).toBe("Actions");

    // Keyboard operable: Tab to the header button, then Enter.
    await user.tab();
    expect(document.activeElement).toBe(within(due).getByRole("button"));
    await user.keyboard("{Enter}");
    expect(onSort).toHaveBeenCalledOnce();
  });
});

describe("DataTableSearch", () => {
  it("labels the search landmark and its input, and clears with a button", async () => {
    const onClear = vi.fn();
    const onSubmit = vi.fn((event: FormEvent<HTMLFormElement>) =>
      event.preventDefault(),
    );
    const user = userEvent.setup({ delay: null });
    render(
      <DataTableSearch
        id="s"
        label="Search invoices"
        formLabel="Invoices"
        value="INV"
        onChange={vi.fn()}
        onSubmit={onSubmit}
        onClear={onClear}
      />,
    );

    expect(screen.getByRole("search", { name: "Invoices" })).toBeTruthy();
    const input = screen.getByRole("searchbox", { name: "Search invoices" });
    await user.type(input, "{Enter}");
    expect(onSubmit).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(onClear).toHaveBeenCalledOnce();
  });
});

describe("DataTableRowActions", () => {
  it("is a named menu button that opens its items from the keyboard", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(
      <DataTableRowActions label="Actions for INV-1">
        <DropdownMenuItem onClick={onSelect}>Mark as paid</DropdownMenuItem>
      </DataTableRowActions>,
    );

    const trigger = screen.getByRole("button", { name: "Actions for INV-1" });
    trigger.focus();
    await user.keyboard("{Enter}");
    const item = await screen.findByRole("menuitem", { name: "Mark as paid" });
    await user.click(item);
    expect(onSelect).toHaveBeenCalledOnce();
  });
});

describe("table states", () => {
  it("announces loading once, with skeletons shaped like the columns", () => {
    render(
      <DataTableSkeleton
        label="Loading invoices…"
        columns={["A", "B"]}
        rows={2}
      />,
    );
    const status = screen.getByRole("status", { name: "Loading invoices…" });
    // The skeleton table is hidden from assistive technology.
    expect(within(status).queryByRole("table")).toBeNull();
    expect(status.querySelectorAll("tbody tr")).toHaveLength(2);
    expect(status.querySelectorAll("tbody tr:first-child td")).toHaveLength(2);
  });

  it("shows an empty state with its action, and an error with Retry", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(
      <>
        <DataTableEmpty
          title="No invoices yet."
          description="Invoices appear here once raised."
          action={<button type="button">Create invoice</button>}
        />
        <DataTableError message="Unable to load invoices." onRetry={onRetry} />
      </>,
    );
    expect(screen.getByText("No invoices yet.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create invoice" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
