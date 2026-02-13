import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from './transactions.entity';
import { Creator } from '../creators/creators.entity';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Injectable()
export class TransactionsService {
    constructor(
        @InjectRepository(Transaction)
        private transactionRepository: Repository<Transaction>,
        @InjectRepository(Creator)
        private creatorRepository: Repository<Creator>,
        private subscriptionsService: SubscriptionsService
    ) {}

    async createTransaction(
        payerWallet: string,
        creatorWallet: string,
        type: string,
        amount: number,
        contentId?: string,
        txHash?: string
    ) {
        const status = type == 'subscription' ? 'pending' : 'confirmed'
        const transaction = this.transactionRepository.create({
            payerWallet,
            creatorWallet,
            type,
            amount,
            contentId,
            txHash,
            status
        });

        await this.transactionRepository.save(transaction);
        return transaction;
    }

    async getTransactionById(id: string) {
        const transaction = await this.transactionRepository.findOne({ where: { id } });
        if (!transaction) {
            throw new NotFoundException('Transaction not found');
        }
        return transaction;
    }

    async getTransactionsByWallet(wallet: string) {
        return await this.transactionRepository.find({
            where: [
                { payerWallet: wallet },
                { creatorWallet: wallet }
            ],
            order: { createdAt: 'DESC' }
        });
    }

    async getTransactionsByCreator(creatorWallet: string) {
        return await this.transactionRepository.find({
            where: { creatorWallet },
            order: { createdAt: 'DESC' }
        });
    }

    async getTransactionsByPayer(payerWallet: string) {
        return await this.transactionRepository.find({
            where: { payerWallet },
            order: { createdAt: 'DESC' }
        });
    }

    async updateTransactionStatus(id: string, status: string, txHash?: string) {
        const transaction = await this.getTransactionById(id);
        transaction.status = status;
        if (txHash) {
            transaction.txHash = txHash;
        }

        await this.transactionRepository.save(transaction);

        // If transaction is confirmed and it's a subscription, create the subscription
        if (status === 'confirmed' && transaction.type === 'subscription') {
            const creator = await this.creatorRepository.findOne({
                where: { walletAddress: transaction.creatorWallet }
            });

            if (creator) {
                await this.subscriptionsService.createSubscription(
                    creator,
                    transaction,
                    transaction.payerWallet
                );
            }
        }

        return transaction;
    }

    async verifyTransaction(txHash: string) {
        // This would integrate with Stacks blockchain API
        // For now, return a placeholder
        // In production, you'd call the Stacks API to verify the transaction
        return {
            verified: false,
            message: 'Blockchain verification not yet implemented'
        };
    }

    async getCreatorEarnings(creatorWallet: string) {
        const transactions = await this.transactionRepository.find({
            where: {
                creatorWallet,
                status: 'confirmed'
            }
        });

        const totalEarnings = transactions.reduce((sum, tx) => sum + tx.amount, 0);
        const subscriptionEarnings = transactions
            .filter(tx => tx.type === 'subscription')
            .reduce((sum, tx) => sum + tx.amount, 0);
        const payPerViewEarnings = transactions
            .filter(tx => tx.type === 'pay-per-view')
            .reduce((sum, tx) => sum + tx.amount, 0);

        return {
            totalEarnings,
            subscriptionEarnings,
            payPerViewEarnings,
            transactionCount: transactions.length
        };
    }
}
