import {
  ECompanyRole,
  ECompanyUserStatus,
} from '@contractflow/contracts-schema';
import { CompanyUser } from '../../../entities/company-user.entity';

export interface ICompanyMemberResponseDto {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  companyRole: ECompanyRole;
  status: ECompanyUserStatus;
  joinedAt: Date;
  leftAt: Date | null;
}

export class CompanyMemberResponseDto implements ICompanyMemberResponseDto {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  companyRole: ECompanyRole;
  status: ECompanyUserStatus;
  joinedAt: Date;
  leftAt: Date | null;

  static fromEntity(
    entity: Pick<
      CompanyUser,
      | 'id'
      | 'userId'
      | 'companyRole'
      | 'status'
      | 'joinedAt'
      | 'leftAt'
      | 'user'
    >,
  ): ICompanyMemberResponseDto {
    return {
      id: entity.id,
      userId: entity.userId,
      firstName: entity.user.firstName,
      lastName: entity.user.lastName,
      email: entity.user.email,
      companyRole: entity.companyRole,
      status: entity.status,
      joinedAt: entity.joinedAt,
      leftAt: entity.leftAt,
    };
  }
}
