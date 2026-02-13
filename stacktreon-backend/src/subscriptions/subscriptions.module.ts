import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { Subscription } from './subscriptions.entity';
import { CreatorsModule } from '../creators/creators.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subscription]),
    CreatorsModule
  ],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService, TypeOrmModule]
})
export class SubscriptionsModule {}
