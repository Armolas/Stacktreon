import {
  Injectable,
  ConflictException,
  NotFoundException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository} from 'typeorm';
import { Creator } from 'src/creators/creators.entity';
import { Subscription } from './subscriptions.entity';
import { Transaction } from 'src/transactions/transactions.entity';


@Injectable()
export class SubscriptionsService {
    constructor(
        @InjectRepository(Creator)
        private creatorRepository: Repository<Creator>,
        @InjectRepository(Subscription)
        private subscriptionRepository: Repository<Subscription>
    ){}

    async createSubscription(
        creator: Creator,
        transaction: Transaction,
        subscriberWallet: string
    ){
        const startedAt = new Date()
        const expiresAt = new Date(startedAt.getTime() + 30 * 24 * 60 * 60 * 1000);

        const subscription = await this.subscriptionRepository.create({
            creator,
            transaction,
            subscriberWallet,
            startedAt,
            expiresAt,
            status: 'active'
        })

        await this.subscriptionRepository.save(subscription);
        return subscription;
    }

    async getCreatorSubscribers(creatorId: string){
        const subscriptions = await this.subscriptionRepository.find({
            where: { creator: { id: creatorId } },
            relations: ['creator']
        });
        return subscriptions;
    }

    async getUserSubscriptions(subscriberWallet: string){
        const subscriptions = await this.subscriptionRepository.find({
            where: { subscriberWallet },
            relations: ['creator', 'transaction']
        });
        return subscriptions;
    }

    async getSubscriptionStatus(creatorId: string, subscriberWallet: string){
        const subscription = await this.subscriptionRepository.findOne({
            where: {
                creator: { id: creatorId },
                subscriberWallet,
                status: 'active'
            },
            relations: ['creator']
        });

        if (!subscription) {
            return { subscribed: false };
        }

        const isExpired = new Date() > subscription.expiresAt;
        if (isExpired) {
            subscription.status = 'expired';
            await this.subscriptionRepository.save(subscription);
            return { subscribed: false, expired: true };
        }

        return {
            subscribed: true,
            subscription,
            expiresAt: subscription.expiresAt
        };
    }

    async isSubscriptionActive(creatorId: string, subscriberWallet: string): Promise<boolean>{
        const status = await this.getSubscriptionStatus(creatorId, subscriberWallet);
        return status.subscribed;
    }
}
