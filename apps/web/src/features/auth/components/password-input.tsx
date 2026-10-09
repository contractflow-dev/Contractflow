"use client";

import { useState, type ComponentProps } from "react";
import { RiEyeLine, RiEyeOffLine, RiLockLine } from "@remixicon/react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@workspace/ui/components/input-group";

export function PasswordInput(
  props: Omit<ComponentProps<typeof InputGroupInput>, "type">,
) {
  const [show, setShow] = useState(false);

  return (
    <InputGroup>
      <InputGroupAddon>
        <RiLockLine />
      </InputGroupAddon>
      <InputGroupInput {...props} type={show ? "text" : "password"} />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          size="icon-xs"
          aria-label={show ? "Hide password" : "Show password"}
          onClick={() => setShow((s) => !s)}
        >
          {show ? <RiEyeOffLine /> : <RiEyeLine />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}
