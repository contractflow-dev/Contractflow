import { describe, expect, it } from 'vitest';
import type { Invoice } from '../entities/invoice.entity';
import type { Payment } from '../entities/payment.entity';
import { toInvoiceResponse, toPaymentResponse } from './financial-response.dto';

describe('financial responses', () => {
  const payment = {
    id: 'pay-1',
    contractId: 'contract-1',
    invoiceId: 'inv-1',
    paymentReference: 'PAY-1',
    idempotencyKey: 'internal-dedupe-key',
    amountMinor: '120000000',
    currencyCode: 'USD',
    invoiceAmountMinor: '180000000000',
    invoiceCurrencyCode: 'NGN',
    fxBaseCurrencyCode: 'USD',
    fxRateMicro: '1500000000',
    fxRateSource: 'CBN',
    fxRateAt: new Date('2026-05-01T09:00:00Z'),
    paymentMethod: 'bank_transfer',
    status: 'approved',
    paymentDate: '2026-05-02',
    externalReference: 'SWIFT-1',
    recordedAt: new Date('2026-05-02T10:00:00Z'),
    recordedById: 'cu-1',
    approvedAt: new Date('2026-05-02T11:00:00Z'),
    approvedById: 'cu-2',
    receiptConfirmedAt: null,
    receiptConfirmedById: '',
    notes: '',
    createdAt: new Date('2026-05-02T10:00:00Z'),
    updatedAt: new Date('2026-05-02T11:00:00Z'),
  } as unknown as Payment;

  it('leaves out the internal idempotency key', () => {
    const response = toPaymentResponse(payment);
    expect(response).not.toHaveProperty('idempotencyKey');
    expect(JSON.stringify(response)).not.toContain('internal-dedupe-key');
  });

  it('reports cross-currency details exactly', () => {
    expect(toPaymentResponse(payment)).toMatchObject({
      amountMinor: '120000000',
      invoiceAmountMinor: '180000000000',
      fxBaseCurrencyCode: 'USD',
      fxRateMicro: '1500000000',
      fxRateAt: '2026-05-01T09:00:00.000Z',
      receiptConfirmedAt: null,
      receiptConfirmedById: null,
    });
  });

  it('reports a same-currency payment without FX details', () => {
    const local = {
      ...payment,
      fxBaseCurrencyCode: '',
      fxRateMicro: null,
      fxRateSource: '',
      fxRateAt: null,
    } as unknown as Payment;
    expect(toPaymentResponse(local)).toMatchObject({
      fxBaseCurrencyCode: null,
      fxRateMicro: null,
      fxRateSource: null,
      fxRateAt: null,
    });
  });

  it('keeps invoice amounts beyond JavaScript number precision exact', () => {
    const invoice = {
      id: 'inv-1',
      contractId: 'contract-1',
      issuedByPartyId: 'p2',
      billedToPartyId: 'p1',
      invoiceNumber: 'INV-1',
      invoiceType: 'interim',
      status: 'certified',
      issueDate: '2026-04-01',
      dueDate: '2026-05-01',
      periodStart: '2026-03-01',
      periodEnd: '2026-03-31',
      currencyCode: 'NGN',
      grossAmountMinor: '9007199254740993',
      adjustmentsTotalMinor: '-1',
      netPayableMinor: '9007199254740992',
      amountPaidMinor: '0',
      submittedAt: new Date('2026-04-01T12:00:00Z'),
      submittedById: 'cu-1',
      certifiedAt: new Date('2026-04-03T12:00:00Z'),
      certifiedById: 'cu-2',
      rejectionReason: '',
      createdAt: new Date('2026-04-01T12:00:00Z'),
      updatedAt: new Date('2026-04-03T12:00:00Z'),
    } as unknown as Invoice;

    expect(toInvoiceResponse(invoice)).toMatchObject({
      grossAmountMinor: '9007199254740993',
      netPayableMinor: '9007199254740992',
      certifiedAt: '2026-04-03T12:00:00.000Z',
      rejectionReason: null,
    });
  });
});
