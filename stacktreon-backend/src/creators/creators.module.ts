import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreatorsController } from './creators.controller';
import { CreatorsService } from './creators.service';
import { Creator } from './creators.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Creator])],
  controllers: [CreatorsController],
  providers: [CreatorsService],
  exports: [CreatorsService, TypeOrmModule]
})
export class CreatorsModule {}
