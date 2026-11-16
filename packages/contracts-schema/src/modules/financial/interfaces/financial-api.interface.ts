import type {
  DateOnlyString,
  IntegerString,
  TimestampString,
} from "../../../common/interfaces/workspace-values.interface.js";
import type { ECurrencyCode } from "../../identity/enums/identity.enum.js";
import type {
  EInvoiceStatus,
  EInvoiceType,
  EPaymentMethod,
  EPaymentStatus,
} from "../enums/financial.enum.js";

/** `GET /contract/invoices`, Finance workspace. */
export interface Invoice {
  id: string;
  contractId: string;
  issuedByPartyId: string;
  billedToPartyId: string;
  invoiceNumber: string;
  invoiceType: EInvoiceType;
  status: EInvoiceStatus;
  issueDate: DateOnlyString;
  dueDate: DateOnlyString;
  periodStart: DateOnlyString;
  periodEnd: DateOnlyString;
  currencyCode: ECurrencyCode;
  grossAmountMinor: IntegerString;
  adjustmentsTotalMinor: IntegerString;
  netPayableMinor: IntegerString;
  amountPaidMinor: IntegerString;
  submittedAt: TimestampString | null;
  submittedById: string | null;
  certifiedAt: TimestampString | null;
  certifiedById: string | null;
  rejectionReason: string | null;
  createdAt: TimestampString;
  updatedAt: TimestampString;
}

/**
 * `GET /contract/payments`, Finance workspace. The idempotency key that
 * de-duplicates recording requests is internal and never returned.
 */
export interface Payment {
  id: string;
  contractId: string;
  invoiceId: string;
  paymentReference: string;
  amountMinor: IntegerString;
  currencyCode: ECurrencyCode;
  /** The amount applied to the invoice, in the invoice currency. */
  invoiceAmountMinor: IntegerString;
  invoiceCurrencyCode: ECurrencyCode;
  /** Set for cross-currency payments. */
  fxBaseCurrencyCode: ECurrencyCode | null;
  /** Exchange rate multiplied by 1,000,000. */
  fxRateMicro: IntegerString | null;
  fxRateSource: string | null;
  fxRateAt: TimestampString | null;
  paymentMethod: EPaymentMethod;
  status: EPaymentStatus;
  paymentDate: DateOnlyString;
  externalReference: string;
  recordedAt: TimestampString;
  recordedById: string;
  approvedAt: TimestampString | null;
  approvedById: string | null;
  receiptConfirmedAt: TimestampString | null;
  receiptConfirmedById: string | null;
  notes: string;
  createdAt: TimestampString;
  updatedAt: TimestampString;
}
