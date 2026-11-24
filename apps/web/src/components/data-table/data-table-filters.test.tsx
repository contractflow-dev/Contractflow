// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  DataTableFilters,
  type DataTableFilterField,
  type DataTableFilterValues,
} from "./data-table-filters";

// jsdom has no PointerEvent, which the checkbox dispatches when pressed.
window.PointerEvent ??= MouseEvent as unknown as typeof PointerEvent;

afterEach(cleanup);

const EMPTY = {
  status: "",
  view: "all",
  archived: "",
  "changed.from": "",
  "changed.to": "",
};

/** A table's owner: it holds the applied values, as the real tables do. */
function Harness({
  initial = EMPTY,
  onApply,
}: {
  initial?: DataTableFilterValues;
  onApply?: (values: DataTableFilterValues) => void;
}) {
  const [applied, setApplied] = useState(initial);
  const fields: DataTableFilterField[] = [
    {
      kind: "select",
      id: "status",
      group: "Record",
      label: "Status",
      value: applied.status,
      options: [
        { value: "", label: "All statuses", count: 5 },
        { value: "open", label: "Open", count: 3 },
        { value: "paid", label: "Paid", group: "Finished" },
      ],
    },
    {
      kind: "select",
      id: "view",
      group: "Record",
      label: "Show",
      value: applied.view,
      resetValue: "all",
      options: [
        { value: "all", label: "All" },
        { value: "overdue", label: "Overdue" },
      ],
    },
    {
      kind: "checkbox",
      id: "archived",
      group: "Record",
      label: "Archived only",
      checked: applied.archived === "true",
    },
    {
      kind: "dateRange",
      id: "changed",
      group: "Dates",
      label: "Changed",
      from: applied["changed.from"],
      to: applied["changed.to"],
      max: "2026-12-31",
    },
  ];
  return (
    <>
      <DataTableFilters
        label="invoices"
        fields={fields}
        onApply={(values) => {
          setApplied(values);
          onApply?.(values);
        }}
      />
      <button type="button" onClick={() => setApplied(EMPTY)}>
        Clear outside
      </button>
    </>
  );
}

const trigger = () => screen.getByRole("button", { name: /^Filters/ });
const reset = () => screen.getByRole("button", { name: "Reset" });
const setup = () => userEvent.setup({ delay: null });

describe("DataTableFilters", () => {
  it("opens from its trigger, grouped, with options, counts and headings", async () => {
    const user = setup();
    render(<Harness />);
    expect(screen.queryByLabelText("Status")).toBeNull();

    await user.click(trigger());
    const dialog = await screen.findByRole("dialog", {
      name: "Filter invoices",
    });
    expect(within(dialog).getByRole("group", { name: "Record" })).toBeTruthy();
    expect(within(dialog).getByRole("group", { name: "Dates" })).toBeTruthy();
    const status = within(dialog).getByLabelText("Status") as HTMLSelectElement;
    expect([...status.options].map((option) => option.textContent)).toEqual([
      "All statuses (5)",
      "Open (3)",
      "Paid",
    ]);
    expect(status.querySelector('optgroup[label="Finished"]')).toBeTruthy();
  });

  it("has no Apply button: each choice applies at once and the dropdown stays open", async () => {
    const onApply = vi.fn();
    const user = setup();
    render(<Harness onApply={onApply} />);

    await user.click(trigger());
    await user.selectOptions(await screen.findByLabelText("Status"), "open");
    expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
    expect(onApply).toHaveBeenLastCalledWith({ ...EMPTY, status: "open" });

    await user.selectOptions(screen.getByLabelText("Show"), "overdue");
    expect(onApply).toHaveBeenLastCalledWith({
      ...EMPTY,
      status: "open",
      view: "overdue",
    });
    await user.click(screen.getByRole("checkbox", { name: "Archived only" }));
    expect(onApply).toHaveBeenCalledTimes(3);
    expect(onApply).toHaveBeenLastCalledWith({
      ...EMPTY,
      status: "open",
      view: "overdue",
      archived: "true",
    });
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(trigger().textContent).toContain("3 active");
  });

  it("doesn't re-apply, and so doesn't leave the page, when nothing changed", async () => {
    const onApply = vi.fn();
    const user = setup();
    render(
      <Harness initial={{ ...EMPTY, status: "open" }} onApply={onApply} />,
    );

    await user.click(trigger());
    await user.selectOptions(await screen.findByLabelText("Status"), "open");
    expect(onApply).not.toHaveBeenCalled();
  });

  it("keeps applied choices when closed and reopened", async () => {
    const user = setup();
    render(<Harness />);

    await user.click(trigger());
    await user.selectOptions(await screen.findByLabelText("Status"), "paid");
    await user.keyboard("{Escape}");
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await user.click(trigger());
    expect(
      ((await screen.findByLabelText("Status")) as HTMLSelectElement).value,
    ).toBe("paid");
  });

  it("resets every filter to its own 'all' value", async () => {
    const onApply = vi.fn();
    const user = setup();
    render(
      <Harness
        initial={{
          ...EMPTY,
          status: "open",
          view: "overdue",
          "changed.from": "2026-01-01",
        }}
        onApply={onApply}
      />,
    );
    expect(trigger().textContent).toContain("3 active");

    await user.click(trigger());
    await screen.findByLabelText("Status");
    await user.click(reset());
    expect(onApply).toHaveBeenCalledWith(EMPTY);
    expect(trigger().textContent).not.toContain("active");
  });

  it("disables Reset when there is nothing to reset", async () => {
    const user = setup();
    render(<Harness />);
    await user.click(trigger());
    await screen.findByLabelText("Status");
    expect((reset() as HTMLButtonElement).disabled).toBe(true);
  });

  it("names each active filter and removes one on its own", async () => {
    const onApply = vi.fn();
    const user = setup();
    render(
      <Harness
        initial={{ ...EMPTY, status: "open", archived: "true" }}
        onApply={onApply}
      />,
    );

    await user.click(trigger());
    const active = await screen.findByRole("list", { name: "Active filters" });
    await user.click(
      within(active).getByRole("button", {
        name: "Remove filter: Status: Open",
      }),
    );
    expect(onApply).toHaveBeenCalledWith({
      ...EMPTY,
      status: "",
      archived: "true",
    });
  });

  it("holds a reversed date range back, keeps it to correct, and applies other choices", async () => {
    const onApply = vi.fn();
    const user = setup();
    render(<Harness onApply={onApply} />);

    await user.click(trigger());
    const dates = await screen.findByRole("group", { name: "Changed" });
    const from = within(dates).getByLabelText("From") as HTMLInputElement;
    const to = within(dates).getByLabelText("To") as HTMLInputElement;
    fireEvent.change(to, { target: { value: "2026-04-01" } });
    onApply.mockClear();
    fireEvent.change(from, { target: { value: "2026-04-10" } });

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("end date");
    expect(from.getAttribute("aria-invalid")).toBe("true");
    expect(to.getAttribute("aria-describedby")).toBe(alert.id);
    expect(onApply).not.toHaveBeenCalled();

    // Another filter still applies, without the reversed day or losing it.
    await user.selectOptions(screen.getByLabelText("Status"), "open");
    expect(onApply).toHaveBeenLastCalledWith({
      ...EMPTY,
      status: "open",
      "changed.to": "2026-04-01",
    });
    expect(from.value).toBe("2026-04-10");

    fireEvent.change(from, { target: { value: "2026-03-01" } });
    expect(onApply).toHaveBeenLastCalledWith({
      ...EMPTY,
      status: "open",
      "changed.from": "2026-03-01",
      "changed.to": "2026-04-01",
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("follows a change made outside, such as an empty state's Clear filters", async () => {
    const user = setup();
    render(<Harness initial={{ ...EMPTY, status: "open" }} />);
    expect(trigger().textContent).toContain("1 active");

    await user.click(screen.getByRole("button", { name: "Clear outside" }));
    expect(trigger().textContent).not.toContain("active");
    await user.click(trigger());
    expect(
      ((await screen.findByLabelText("Status")) as HTMLSelectElement).value,
    ).toBe("");
  });

  it("returns focus to the trigger after Reset", async () => {
    const user = setup();
    render(<Harness initial={{ ...EMPTY, status: "open" }} />);
    await user.click(trigger());
    await screen.findByLabelText("Status");
    await user.click(reset());
    await vi.waitFor(() => expect(document.activeElement).toBe(trigger()));
  });
});
