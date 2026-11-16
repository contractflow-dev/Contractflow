import { EPartyType } from "@contractflow/contracts-schema";
import { Badge } from "@workspace/ui/components/badge";

/** The words for each party type, wherever a company's part is shown. */
export const PARTY_TYPE_LABELS: Record<EPartyType, string> = {
  [EPartyType.CLIENT]: "Client",
  [EPartyType.CONTRACTOR]: "Contractor",
  [EPartyType.SUBCONTRACTOR]: "Subcontractor",
  [EPartyType.VENDOR]: "Vendor",
  [EPartyType.OTHER]: "Other",
};

/**
 * A company's part in a contract. Neutral and outlined: it describes, it
 * doesn't warn, and its label carries the meaning.
 */
export function PartyTypeBadge({
  partyType,
  className,
}: {
  partyType: EPartyType;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={className}>
      {PARTY_TYPE_LABELS[partyType] ?? partyType}
    </Badge>
  );
}
