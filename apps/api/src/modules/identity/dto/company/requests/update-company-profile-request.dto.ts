import { PartialType } from '@nestjs/mapped-types';
import { CreateCompanyRequestDto } from './create-company-request.dto';

export class UpdateCompanyProfileRequestDto extends PartialType(
  CreateCompanyRequestDto,
) {}
