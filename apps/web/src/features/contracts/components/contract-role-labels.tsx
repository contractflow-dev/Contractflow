"use client";

import { createContext, useCallback, useContext, type ReactNode } from "react";
import { contractRoleLabel } from "@contractflow/contracts-schema";

const SubcontractContext = createContext(false);

/**
 * Names the contract roles of everything inside for a main contract or a
 * subcontract. On a subcontract the main contractor holds the client-side
 * roles and the subcontractor the contractor-side ones, so they read
 * "Main Contractor …" and "Subcontractor …". Display only.
 */
export function ContractRoleLabels({
  isSubcontract,
  children,
}: {
  isSubcontract: boolean;
  children: ReactNode;
}) {
  return (
    <SubcontractContext.Provider value={isSubcontract}>
      {children}
    </SubcontractContext.Provider>
  );
}

/** A contract role's label on the contract being shown (main contract wording outside one). */
export function useContractRoleLabel(): (role: string) => string {
  const isSubcontract = useContext(SubcontractContext);
  return useCallback(
    (role: string) => contractRoleLabel(role, isSubcontract),
    [isSubcontract],
  );
}

/** The side's name: client and contractor, or main contractor and subcontractor. */
export function useContractSideLabel(): (
  side: "client" | "contractor",
) => string {
  const isSubcontract = useContext(SubcontractContext);
  return useCallback(
    (side: "client" | "contractor") =>
      isSubcontract
        ? side === "client"
          ? "main contractor"
          : "subcontractor"
        : side,
    [isSubcontract],
  );
}
