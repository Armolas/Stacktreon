import { IsString, IsNotEmpty } from 'class-validator';

export class CreateSubscriptionDto {
  @IsString()
  @IsNotEmpty()
  creatorId: string;

  @IsString()
  @IsNotEmpty()
  subscriberWallet: string;

  @IsString()
  @IsNotEmpty()
  transactionId: string;
}
