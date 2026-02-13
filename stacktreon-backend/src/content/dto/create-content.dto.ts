import { IsString, IsNotEmpty, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateContentDto {

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @Transform(({ value }) => parseFloat(value))
  @Min(0)
  price: number;
}
