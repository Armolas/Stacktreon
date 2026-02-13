import { IsString, IsNumber, IsNotEmpty, MinLength, Min, IsArray, IsOptional, IsIn } from 'class-validator';

const ALLOWED_CATEGORIES = [
  'Digital Art',
  'Music',
  'Writing',
  'Education',
  'Gaming',
  'Photography',
  'Development',
  'Video Production',
  'Podcasting',
  'Comics',
  'Animation',
  'Crafts',
  'Technology',
  'Fitness',
  'Cooking',
  'Other'
];

export class RegisterCreatorDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  username: string;

  @IsString()
  @IsNotEmpty()
  displayName: string;

  @IsString()
  @IsNotEmpty()
  walletAddress: string;

  @IsString()
  @IsNotEmpty()
  bns: string;

  @IsNumber()
  @Min(0)
  subscriptionFee: number;

  @IsString()
  @IsNotEmpty()
  bio: string;

  @IsString()
  @IsNotEmpty()
  about: string;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  @IsIn(ALLOWED_CATEGORIES, { each: true, message: 'Invalid category. Allowed categories: ' + ALLOWED_CATEGORIES.join(', ') })
  categories?: string[];
}
