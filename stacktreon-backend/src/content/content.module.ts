import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { Content } from './content.entity';
import { CreatorsModule } from '../creators/creators.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { StorageModule } from '../storage/storage.module';
import { TransactionsModule } from '../transactions/transactions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Content]),
    CreatorsModule,
    SubscriptionsModule,
    StorageModule,
    TransactionsModule
  ],
  controllers: [ContentController],
  providers: [ContentService],
  exports: [ContentService, TypeOrmModule]
})
export class ContentModule {}
