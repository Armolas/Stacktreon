import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, UseInterceptors, UploadedFile, Req } from '@nestjs/common';
import { ContentService } from './content.service';
import { CreateContentDto } from './dto/create-content.dto';
import { getPayment } from 'x402-stacks';
import { X402Guard } from '../payments/x402/x402.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService } from '../storage/storage.service';
import { TransactionsService } from '../transactions/transactions.service';
import type { Request } from 'express';


const NETWORK = (process.env.NETWORK as 'mainnet' | 'testnet') || 'testnet';

// Define the Multer file type interface
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
  stream?: any;
  destination?: string;
  filename?: string;
  path?: string;
}

@Controller('content')
export class ContentController {
    constructor(
        private readonly contentService: ContentService,
        private readonly storageService: StorageService,
        private readonly transactionService: TransactionsService
    ) {}

    @Post(':creatorId/upload')
    @UseInterceptors(FileInterceptor('file'))
    async uploadContent(
        @Param('creatorId') creatorId: string,
        @UploadedFile() file: MulterFile,
        @Body() dto: CreateContentDto
    ) {
        const fileKey = await this.storageService.uploadFile(file);

        const content = await this.contentService.createContent(
            creatorId,
            dto.title,
            dto.description,
            this.detectType(file.mimetype),
            fileKey,
            dto.price
        );

        return content;
    }

    @Get()
    async getAllContent() {
        return this.contentService.getAllContent();
    }

    @Get('creator/:creatorId')
    async getContentByCreator(
        @Param('creatorId') creatorId: string,
        @Query('userWallet') userWallet?: string
    ) {
        return this.contentService.getContentByCreator(creatorId, userWallet);
    }

    @Get(':id')
    async getContentById(
        @Param('id') id: string,
        @Query('userWallet') userWallet?: string
    ) {
        return this.contentService.getContentById(id, userWallet);
    }

    @UseGuards(X402Guard)
    @Get('x402/:id')
    async getPremiumContent(@Param('id') id: string, @Req() req: Request) {
        const payment = getPayment(req);
        const data = await this.contentService.getSecureContent(id);
        await this.contentService.incrementViewCount(id);

        // Create transaction record for successful x402 payment
        if (payment?.payer && payment?.transaction) {
            await this.transactionService.createTransaction(
                payment.payer,
                data.creator.walletAddress,
                'pay-per-view',
                data.price,
                id,
                payment.transaction
            );
        }

        return {
            data,
            payment: {
                transaction: payment?.transaction,
                payer: payment?.payer,
                network: payment?.network,
            },
            message: "success"
        };
    }

    @Put(':id')
    async updateContent(
        @Param('id') id: string,
        @Body('creatorId') creatorId: string,
        @Body() updates: Partial<CreateContentDto>
    ) {
        return this.contentService.updateContent(id, creatorId, updates);
    }

    @Delete(':id')
    async deleteContent(
        @Param('id') id: string,
        @Query('creatorId') creatorId: string
    ) {
        return this.contentService.deleteContent(id, creatorId);
    }


    private detectType(mimetype: string): string {
        if (mimetype.startsWith('video')) return 'video';
        if (mimetype.startsWith('audio')) return 'audio';
        return 'article';
    }
}
