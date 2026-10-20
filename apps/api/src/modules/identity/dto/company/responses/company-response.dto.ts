import {
  ECompanyStatus,
  ECurrencyCode,
  ICompanyResponseDto,
} from '@contractflow/contracts-schema';
import { Company } from '../../../entities/company.entity';
import e from 'express';

export class CompanyResponseDto implements ICompanyResponseDto {
  id: string;
  name: string;
  legalName: string;
  registrationNumber: string;
  taxIdentificationNumber: string;
  email: string;
  phoneNumber: string;
  website: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  countryCode: string;
  defaultCurrencyCode: ECurrencyCode;
  status: ECompanyStatus;
  verifiedAt: Date | null;

  static fromEntity(entity: Company) {
    return {
      id: entity.id,
      name: entity.name,
      legalName: entity.legalName,
      registrationNumber: entity.registrationNumber,
      taxIdentificationNumber: entity.taxIdentificationNumber,
      email: entity.email,
      phoneNumber: entity.phoneNumber,
      website: entity.website,
      addressLine1: entity.addressLine1,
      addressLine2: entity.addressLine2,
      city: entity.city,
      stateRegion: entity.stateRegion,
      postalCode: entity.postalCode,
      countryCode: entity.countryCode,
      defaultCurrencyCode: entity.defaultCurrencyCode,
      status: entity.status,
      verifiedAt: entity.verifiedAt,
    };
  }
}
