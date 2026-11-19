// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DropdownMenuItem } from "@workspace/ui/components/dropdown-menu";
import {
  DataTable,
  DataTableEmpty,
  DataTableRowActions,
  type DataTableColumn,
} from "./data-table";

afterEach(cleanup);

interface Invoice {
  id: string;
  number: string;
  customer: string;
  amount: string;
  status: string;
}

const invoices: Invoice[] = [
  {
    id: "i-1",
    number: "INV-1",
    customer: "Acme",
    amount: "₦1,500.00",
    status: "Open",
  },
  {
    id: "i-2",
    number: "INV-2",
    customer: "Bravo",
    amount: "₦250.00",
    status: "Paid",
  },
];

const columns: ReadonlyArray<DataTableColumn<Invoice>> = [
  { id: "number", header: "Number", sortable: true, cell: (row) => row.number },
  {
    id: "customer",
    header: "Customer",
    wrap: true,
    hideBelow: "md",
    cell: (row) => row.customer,
  },
  { id: "amount", header: "Amount", numeric: true, cell: (row) => row.amount },
  { id: "status", header: "Status", cell: (row) => row.status },
];

type Props = Parameters<typeof DataTable<Invoice>>[0];

function renderTable(props: Partial<Props> = {}) {
  return render(
    <DataTable<Invoice>
      label="Invoices"
      columns={columns}
      rows={invoices}
      getRowKey={(row) => row.id}
      loadingLabel="Loading invoices…"
      empty={<DataTableEmpty title="No invoices yet." />}
      {...props}
    />,
  );
}

const table = () => screen.getByRole("table", { name: "Invoices" });

describe("DataTable from a column configuration", () => {
  it("renders the feature's columns and rows as a named, semantic table", () => {
    renderTable();

    expect(
      within(table())
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual(["Number", "Customer", "Amount", "Status"]);
    const rows = within(table()).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(
      within(rows[0])
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual(["INV-1", "Acme", "₦1,500.00", "Open"]);
  });

  it("aligns numbers right in tabular figures, wraps long text and hides low-priority columns on narrow screens", () => {
    renderTable();
    const [header] = within(table()).getAllByRole("row");
    const amountHeader = within(header).getByRole("columnheader", {
      name: "Amount",
    });
    expect(amountHeader.className).toContain("text-end");
    const cells = within(within(table()).getAllByRole("row")[1]).getAllByRole(
      "cell",
    );
    expect(cells[2].className).toContain("text-end");
    expect(cells[2].className).toContain("tabular-nums");
    expect(cells[1].className).toContain("whitespace-normal");
    expect(cells[1].className).toContain("hidden md:table-cell");
    expect(
      within(header).getByRole("columnheader", { name: "Customer" }).className,
    ).toContain("hidden md:table-cell");
  });

  it("makes only sortable columns sortable, and reports the column id", async () => {
    const onSort = vi.fn();
    const user = userEvent.setup({ delay: null });
    renderTable({ sort: { columnId: "number", direction: "desc", onSort } });

    const number = within(table()).getByRole("columnheader", {
      name: /Number/,
    });
    expect(number.getAttribute("aria-sort")).toBe("descending");
    expect(
      within(
        within(table()).getByRole("columnheader", { name: "Status" }),
      ).queryByRole("button"),
    ).toBeNull();

    await user.click(within(number).getByRole("button"));
    expect(onSort).toHaveBeenCalledWith("number");
  });

  it("adds an actions column only with row actions, with a menu per row", async () => {
    const user = userEvent.setup({ delay: null });
    const markPaid = vi.fn();
    renderTable({
      rowActions: (row) => (
        <DataTableRowActions label={`Actions for ${row.number}`}>
          <DropdownMenuItem onClick={() => markPaid(row.id)}>
            Mark as paid
          </DropdownMenuItem>
        </DataTableRowActions>
      ),
    });

    expect(
      within(table()).getAllByRole("columnheader").at(-1)?.textContent,
    ).toBe("Actions");
    await user.click(screen.getByRole("button", { name: "Actions for INV-2" }));
    await user.click(
      await screen.findByRole("menuitem", { name: "Mark as paid" }),
    );
    expect(markPaid).toHaveBeenCalledWith("i-2");
  });

  it("applies per-row attributes, such as deep-link targets", () => {
    renderTable({
      getRowProps: (row) => ({
        id: `activity-target-${row.id}`,
        className: row.id === "i-2" ? "bg-primary/10" : undefined,
      }),
    });
    const target = document.getElementById("activity-target-i-2");
    expect(target?.tagName).toBe("TR");
    expect(target?.className).toContain("bg-primary/10");
  });

  it("shows cards below md and the table from md when given a card layout", () => {
    renderTable({ renderCard: (row) => <p>Card {row.number}</p> });

    const cards = screen.getByRole("list", { name: "Invoices" });
    expect(cards.className).toContain("md:hidden");
    expect(within(cards).getAllByRole("listitem")).toHaveLength(2);
    expect(
      document.querySelector('[data-slot="data-table"]')?.className,
    ).toContain("hidden md:block");
  });

  it("pages through the API's results", async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup({ delay: null });
    renderTable({
      pagination: {
        meta: {
          totalItems: 45,
          itemCount: 2,
          itemsPerPage: 20,
          totalPages: 3,
          currentPage: 1,
        },
        itemLabel: "invoices",
        onPageChange,
      },
    });

    expect(screen.getByText(/of 45 invoices$/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Go to next page" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("shows the error with Retry rather than rows, then loading, then the empty state", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup({ delay: null });
    const { rerender } = renderTable({
      error: "Unable to load invoices.",
      onRetry,
      isLoading: true,
    });
    expect(screen.getByText("Unable to load invoices.")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();

    rerender(
      <DataTable<Invoice>
        label="Invoices"
        columns={columns}
        rows={[]}
        getRowKey={(row) => row.id}
        isLoading
        loadingLabel="Loading invoices…"
        empty={<DataTableEmpty title="No invoices yet." />}
      />,
    );
    expect(
      screen.getByRole("status", { name: "Loading invoices…" }),
    ).toBeTruthy();

    rerender(
      <DataTable<Invoice>
        label="Invoices"
        columns={columns}
        rows={[]}
        getRowKey={(row) => row.id}
        loadingLabel="Loading invoices…"
        empty={<DataTableEmpty title="No invoices yet." />}
      />,
    );
    expect(screen.getByText("No invoices yet.")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });
});
