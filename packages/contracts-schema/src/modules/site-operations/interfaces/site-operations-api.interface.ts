import type {
  DateOnlyString,
  IntegerString,
  TimestampString,
} from "../../../common/interfaces/workspace-values.interface.js";
import type { ECurrencyCode } from "../../identity/enums/identity.enum.js";
import type {
  ESiteStatus,
  ETransactionType,
  EWeatherCondition,
} from "../enums/site-operations.enum.js";

// `GET /contract/sites` returns `ContractSite` (contract-site-api.interface).

/** `GET /contract/daily-logs`, Project workspace. */
export interface SiteDailyLog {
  id: string;
  contractId: string;
  contractSiteId: string;
  contractPartyId: string;
  logDate: DateOnlyString;
  weatherCondition: EWeatherCondition;
  temperatureCelsius: number;
  weatherDelayMinutes: number;
  workPerformed: string;
  workPlannedNext: string;
  issuesAndDelays: string;
  status: ESiteStatus;
  submittedAt: TimestampString | null;
  submittedById: string | null;
  approvedAt: TimestampString | null;
  approvedById: string | null;
  rejectionReason: string | null;
  createdAt: TimestampString;
  updatedAt: TimestampString;
}

/** `GET /contract/inventory-items`, Project workspace. */
export interface InventoryItem {
  id: string;
  contractId: string;
  contractSiteId: string;
  contractPartyId: string;
  itemCode: string;
  name: string;
  category: string;
  unitOfMeasure: string;
  /** Thousandths of `unitOfMeasure`. */
  quantityOnHandMilli: IntegerString;
  reorderLevelMilli: IntegerString;
  createdAt: TimestampString;
  updatedAt: TimestampString;
}

/** `GET /contract/inventory-transactions`, Project workspace. */
export interface InventoryTransaction {
  id: string;
  contractId: string;
  inventoryItemId: string;
  siteDailyLogId: string | null;
  transactionType: ETransactionType;
  /** Thousandths of the item unit of measure. */
  quantityMilli: IntegerString;
  unitCostMinor: IntegerString;
  currencyCode: ECurrencyCode;
  referenceNumber: string;
  counterPartyName: string;
  transactionAt: TimestampString;
  performedById: string;
  remarks: string;
  createdAt: TimestampString;
  updatedAt: TimestampString;
}
