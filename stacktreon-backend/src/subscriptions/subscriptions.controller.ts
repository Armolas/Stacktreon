import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

@Controller('subscriptions')
export class SubscriptionsController {
    constructor(private readonly subscriptionsService: SubscriptionsService) {}

    @Post()
    async createSubscription(@Body() dto: CreateSubscriptionDto) {
        // This would typically be called after verifying the transaction
        // For now, we'll need to fetch the creator and transaction
        // Implementation will depend on how transactions are handled
        return { message: 'Use transactions module to create subscription' };
    }

    @Get('creator/:creatorId')
    async getCreatorSubscribers(@Param('creatorId') creatorId: string) {
        return this.subscriptionsService.getCreatorSubscribers(creatorId);
    }

    @Get('user/:wallet')
    async getUserSubscriptions(@Param('wallet') wallet: string) {
        return this.subscriptionsService.getUserSubscriptions(wallet);
    }

    @Get('status')
    async getSubscriptionStatus(
        @Query('creatorId') creatorId: string,
        @Query('userWallet') userWallet: string
    ) {
        return this.subscriptionsService.getSubscriptionStatus(creatorId, userWallet);
    }

    @Get('check-access')
    async checkAccess(
        @Query('creatorId') creatorId: string,
        @Query('userWallet') userWallet: string
    ) {
        const isActive = await this.subscriptionsService.isSubscriptionActive(creatorId, userWallet);
        return { hasAccess: isActive };
    }
}
