import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  DropdownMenu,
  DropdownMenuGroup,
  DropdownMenuLabel,
} from "@workspace/ui/components/dropdown-menu";

describe("Company admin account menu composition", () => {
  it("renders a menu label inside the Base UI group context", () => {
    const markup = renderToStaticMarkup(
      <DropdownMenu open>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Account</DropdownMenuLabel>
        </DropdownMenuGroup>
      </DropdownMenu>,
    );

    expect(markup).toContain("Account");
  });
});
