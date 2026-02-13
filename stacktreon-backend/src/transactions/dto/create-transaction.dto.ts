import { IsString, IsNumber, IsNotEmpty, IsOptional, IsIn, Min } from 'class-validator';

export class CreateTransactionDto {
  @IsString()
  @IsNotEmpty()
  payerWallet: string;

  @IsString()
  @IsNotEmpty()
  creatorWallet: string;

  @IsString()
  @IsOptional()
  contentId?: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['subscription', 'pay-per-view'])
  type: string;

  @IsNumber()
  @Min(0)
  amountCents: number;

  @IsString()
  @IsOptional()
  txHash?: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['pending', 'confirmed', 'failed'])
  status: string;
}
