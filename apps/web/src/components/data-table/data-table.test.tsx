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
  DataTable,
  DataTableEmpty,
  DataTableError,
  DataTableRowActions,
  DataTableSkeleton,
  SortableTableHead,
} from "./data-table";
import {
  DataTableActiveFilters,
  DataTableFilterChips,
  DataTableSearch,
} from "./data-table-toolbar";

afterEach(cleanup);

describe("DataTable", () => {
  it("is a named, semantic table with sortable and action headers", async () => {
    const onSort = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(
      <DataTable label="Invoices">
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
      </DataTable>,
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

describe("DataTableFilterChips", () => {
  it("presses exactly the selected filter and reports the chosen one", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(
      <DataTableFilterChips
        label="Invoice status"
        countNoun="invoices"
        value="open"
        onChange={onChange}
        options={[
          { value: "", label: "All", count: 4 },
          { value: "open", label: "Open", count: 3 },
          { value: "paid", label: "Paid" },
        ]}
      />,
    );

    const group = screen.getByRole("group", { name: "Invoice status" });
    const buttons = within(group).getAllByRole("button");
    expect(
      buttons.map((button) => button.getAttribute("aria-pressed")),
    ).toEqual(["false", "true", "false"]);
    // Counts are read with their noun; a filter without one shows none.
    expect(buttons[1].textContent).toBe("Open3, 3 invoices");
    expect(buttons[2].textContent).toBe("Paid");

    await user.click(buttons[2]);
    expect(onChange).toHaveBeenCalledWith("paid");
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

describe("DataTableActiveFilters", () => {
  it("removes one filter, and offers Clear all only for more than one", async () => {
    const remove = vi.fn();
    const clearAll = vi.fn();
    const user = userEvent.setup({ delay: null });
    const { rerender } = render(
      <DataTableActiveFilters
        filters={[{ key: "a", label: "Archived only", onRemove: remove }]}
        onClearAll={clearAll}
      />,
    );
    expect(screen.queryByRole("button", { name: "Clear all" })).toBeNull();
    await user.click(
      screen.getByRole("button", { name: "Remove filter: Archived only" }),
    );
    expect(remove).toHaveBeenCalledOnce();

    rerender(
      <DataTableActiveFilters
        filters={[
          { key: "a", label: "Archived only", onRemove: remove },
          { key: "s", label: "Search: “x”", onRemove: vi.fn() },
        ]}
        onClearAll={clearAll}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Clear all" }));
    expect(clearAll).toHaveBeenCalledOnce();
  });

  it("renders nothing without active filters", () => {
    const { container } = render(
      <DataTableActiveFilters filters={[]} onClearAll={vi.fn()} />,
    );
    expect(container.innerHTML).toBe("");
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
