import type {
  ECurrencyCode,
  Invoice as InvoiceResponse,
  Payment as PaymentResponse,
} from '@contractflow/contracts-schema';
import {
  toDateOnly,
  toIntegerString,
  toNullable,
  toNullableIntegerString,
  toNullableText,
  toNullableTimestamp,
  toTimestamp,
} from '../../../common/dto/response-values';
import type { Invoice } from '../entities/invoice.entity';
import type { Payment } from '../entities/payment.entity';

export function toInvoiceResponse(invoice: Invoice): InvoiceResponse {
  return {
    id: invoice.id,
    contractId: invoice.contractId,
    issuedByPartyId: invoice.issuedByPartyId,
    billedToPartyId: invoice.billedToPartyId,
    invoiceNumber: invoice.invoiceNumber,
    invoiceType: invoice.invoiceType,
    status: invoice.status,
    issueDate: toDateOnly(invoice.issueDate),
    dueDate: toDateOnly(invoice.dueDate),
    periodStart: toDateOnly(invoice.periodStart),
    periodEnd: toDateOnly(invoice.periodEnd),
    currencyCode: invoice.currencyCode,
    grossAmountMinor: toIntegerString(invoice.grossAmountMinor),
    adjustmentsTotalMinor: toIntegerString(invoice.adjustmentsTotalMinor),
    netPayableMinor: toIntegerString(invoice.netPayableMinor),
    amountPaidMinor: toIntegerString(invoice.amountPaidMinor),
    submittedAt: toNullableTimestamp(invoice.submittedAt),
    submittedById: toNullableText(invoice.submittedById),
    certifiedAt: toNullableTimestamp(invoice.certifiedAt),
    certifiedById: toNullableText(invoice.certifiedById),
    rejectionReason: toNullableText(invoice.rejectionReason),
    createdAt: toTimestamp(invoice.createdAt),
    updatedAt: toTimestamp(invoice.updatedAt),
  };
}

/** Leaves out the internal idempotency key. */
export function toPaymentResponse(payment: Payment): PaymentResponse {
  return {
    id: payment.id,
    contractId: payment.contractId,
    invoiceId: payment.invoiceId,
    paymentReference: payment.paymentReference,
    amountMinor: toIntegerString(payment.amountMinor),
    currencyCode: payment.currencyCode,
    invoiceAmountMinor: toIntegerString(payment.invoiceAmountMinor),
    // The entity types these char(3) columns as plain strings.
    invoiceCurrencyCode: payment.invoiceCurrencyCode as ECurrencyCode,
    fxBaseCurrencyCode: toNullable(
      payment.fxBaseCurrencyCode as ECurrencyCode | '',
    ),
    fxRateMicro: toNullableIntegerString(payment.fxRateMicro),
    fxRateSource: toNullableText(payment.fxRateSource),
    fxRateAt: toNullableTimestamp(payment.fxRateAt),
    paymentMethod: payment.paymentMethod,
    status: payment.status,
    paymentDate: toDateOnly(payment.paymentDate),
    externalReference: payment.externalReference,
    recordedAt: toTimestamp(payment.recordedAt),
    recordedById: payment.recordedById,
    approvedAt: toNullableTimestamp(payment.approvedAt),
    approvedById: toNullableText(payment.approvedById),
    receiptConfirmedAt: toNullableTimestamp(payment.receiptConfirmedAt),
    receiptConfirmedById: toNullableText(payment.receiptConfirmedById),
    notes: payment.notes,
    createdAt: toTimestamp(payment.createdAt),
    updatedAt: toTimestamp(payment.updatedAt),
  };
}
