import type {
  ContractSite as ContractSiteResponse,
  InventoryItem as InventoryItemResponse,
  InventoryTransaction as InventoryTransactionResponse,
  SiteDailyLog as SiteDailyLogResponse,
} from '@contractflow/contracts-schema';
import {
  toDateOnly,
  toIntegerString,
  toNullableText,
  toNullableTimestamp,
  toTimestamp,
} from '../../../common/dto/response-values';
import type { ContractSite } from '../entities/contract-site.entity';
import type { InventoryItem } from '../entities/inventory-item.entity';
import type { InventoryTransaction } from '../entities/inventory-transaction.entity';
import type { SiteDailyLog } from '../entities/site-daily-log.entity';

/** The same shape as the site-management endpoints return. */
export function toContractSiteResponse(
  site: ContractSite,
): ContractSiteResponse {
  return {
    id: site.id,
    contractId: site.contractId,
    name: site.name,
    siteCode: site.siteCode,
    addressLine1: site.addressLine1,
    city: site.city,
    stateRegion: site.stateRegion,
    countryCode: site.countryCode,
    latitudeE6: site.latitudeE6,
    longitudeE6: site.longitudeE6,
    status: site.status,
    createdAt: toTimestamp(site.createdAt),
    updatedAt: toTimestamp(site.updatedAt),
  };
}

export function toSiteDailyLogResponse(
  log: SiteDailyLog,
): SiteDailyLogResponse {
  return {
    id: log.id,
    contractId: log.contractId,
    contractSiteId: log.contractSiteId,
    contractPartyId: log.contractPartyId,
    logDate: toDateOnly(log.logDate),
    weatherCondition: log.weatherCondition,
    temperatureCelsius: log.temperatureCelsius,
    weatherDelayMinutes: log.weatherDelayMinutes,
    workPerformed: log.workPerformed,
    workPlannedNext: log.workPlannedNext,
    issuesAndDelays: log.issuesAndDelays,
    status: log.status,
    submittedAt: toNullableTimestamp(log.submittedAt),
    submittedById: toNullableText(log.submittedById),
    approvedAt: toNullableTimestamp(log.approvedAt),
    approvedById: toNullableText(log.approvedById),
    rejectionReason: toNullableText(log.rejectionReason),
    createdAt: toTimestamp(log.createdAt),
    updatedAt: toTimestamp(log.updatedAt),
  };
}

export function toInventoryItemResponse(
  item: InventoryItem,
): InventoryItemResponse {
  return {
    id: item.id,
    contractId: item.contractId,
    contractSiteId: item.contractSiteId,
    contractPartyId: item.contractPartyId,
    itemCode: item.itemCode,
    name: item.name,
    category: item.category,
    unitOfMeasure: item.unitOfMeasure,
    quantityOnHandMilli: toIntegerString(item.quantityOnHandMilli),
    reorderLevelMilli: toIntegerString(item.reorderLevelMilli),
    createdAt: toTimestamp(item.createdAt),
    updatedAt: toTimestamp(item.updatedAt),
  };
}

export function toInventoryTransactionResponse(
  transaction: InventoryTransaction,
): InventoryTransactionResponse {
  return {
    id: transaction.id,
    contractId: transaction.contractId,
    inventoryItemId: transaction.inventoryItemId,
    siteDailyLogId: toNullableText(transaction.siteDailyLogId),
    transactionType: transaction.transactionType,
    quantityMilli: toIntegerString(transaction.quantityMilli),
    unitCostMinor: toIntegerString(transaction.unitCostMinor),
    currencyCode: transaction.currencyCode,
    referenceNumber: transaction.referenceNumber,
    counterPartyName: transaction.counterPartyName,
    transactionAt: toTimestamp(transaction.transactionAt),
    performedById: transaction.performedById,
    remarks: transaction.remarks,
    createdAt: toTimestamp(transaction.createdAt),
    updatedAt: toTimestamp(transaction.updatedAt),
  };
}
