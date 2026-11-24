import { RiUserLine } from "@remixicon/react";
import type { AppNavGroup } from "@/components/app-shell/navigation";

/**
 * The signed-in user's own profile. It sits outside `/dashboards`, so it
 * needs no company: it works the same whichever company is selected, or with
 * none.
 */
export const ACCOUNT_PROFILE_PATH = "/account/profile";

/**
 * The personal account's pages, for the account area's sidebar. Only built
 * pages are listed; security, sessions, notifications and preferences join
 * as they are built.
 */
export const ACCOUNT_NAVIGATION: readonly AppNavGroup[] = [
  {
    label: "My Account",
    items: [
      {
        href: ACCOUNT_PROFILE_PATH,
        label: "Personal Profile",
        icon: RiUserLine,
      },
    ],
  },
];
