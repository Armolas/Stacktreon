import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';

@Controller('transactions')
export class TransactionsController {
    constructor(private readonly transactionsService: TransactionsService) {}

    @Post()
    async createTransaction(@Body() dto: CreateTransactionDto) {
        return this.transactionsService.createTransaction(
            dto.payerWallet,
            dto.creatorWallet,
            dto.type,
            dto.amountCents,
            dto.contentId,
            dto.txHash
        );
    }

    @Get(':id')
    async getTransactionById(@Param('id') id: string) {
        return this.transactionsService.getTransactionById(id);
    }

    @Get('wallet/:wallet')
    async getTransactionsByWallet(@Param('wallet') wallet: string) {
        return this.transactionsService.getTransactionsByWallet(wallet);
    }

    @Get('creator/:creatorWallet')
    async getTransactionsByCreator(@Param('creatorWallet') creatorWallet: string) {
        return this.transactionsService.getTransactionsByCreator(creatorWallet);
    }

    @Get('payer/:payerWallet')
    async getTransactionsByPayer(@Param('payerWallet') payerWallet: string) {
        return this.transactionsService.getTransactionsByPayer(payerWallet);
    }

    @Put(':id/status')
    async updateTransactionStatus(
        @Param('id') id: string,
        @Body('status') status: string,
        @Body('txHash') txHash?: string
    ) {
        return this.transactionsService.updateTransactionStatus(id, status, txHash);
    }

    @Get('verify/:txHash')
    async verifyTransaction(@Param('txHash') txHash: string) {
        return this.transactionsService.verifyTransaction(txHash);
    }

    @Get('earnings/:creatorWallet')
    async getCreatorEarnings(@Param('creatorWallet') creatorWallet: string) {
        return this.transactionsService.getCreatorEarnings(creatorWallet);
    }
}
