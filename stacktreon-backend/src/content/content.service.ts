import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Content } from './content.entity';
import { Creator } from '../creators/creators.entity';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { StorageService } from 'src/storage/storage.service';

@Injectable()
export class ContentService {
    constructor(
        @InjectRepository(Content)
        private contentRepository: Repository<Content>,
        @InjectRepository(Creator)
        private creatorRepository: Repository<Creator>,
        private subscriptionsService: SubscriptionsService,
        private storageService: StorageService
    ) {}

    async createContent(
        creatorId: string,
        title: string,
        description: string,
        contentType: string,
        fileUrl: string,
        price: number
    ) {
        const creator = await this.creatorRepository.findOne({ where: { id: creatorId } });
        if (!creator) {
            throw new NotFoundException('Creator not found');
        }

        const content = this.contentRepository.create({
            creator,
            title,
            description,
            contentType,
            fileUrl,
            price,
            viewCount: 0
        });

        await this.contentRepository.save(content);
        return content;
    }

    async getContentById(id: string, userWallet?: string) {
        const content = await this.contentRepository.findOne({
            where: { id },
            relations: ['creator']
        });

        if (!content) {
            throw new NotFoundException('Content not found');
        }
        const signedUrl = await this.storageService.getSignedUrl(content.fileUrl);
        const secureContent = {
            ...content,
            fileUrl: signedUrl
        }
        // If content is free, return it
        if (content.price === 0) {
            return secureContent;
        }

        // If user is provided, check access
        if (userWallet) {
            const hasAccess = await this.checkContentAccess(content.creator.id, userWallet);
            if (hasAccess) {
                return secureContent;
            }
        }

        // Return content with limited info if no access
        return {
            ...content,
            fileUrl: null, // Hide file URL if no access
            locked: true
        };
    }
    async getSecureContent(id: string) {
        const content = await this.contentRepository.findOne({
            where: { id },
            relations: ['creator']
        });

        if (!content) {
            throw new NotFoundException('Content not found');
        }
        const signedUrl = await this.storageService.getSignedUrl(content.fileUrl);
        const secureContent = {
            ...content,
            fileUrl: signedUrl
        }
        return secureContent;
    }

    async getContentByCreator(creatorId: string, userWallet?: string) {
        const contents = await this.contentRepository.find({
            where: { creator: { id: creatorId } },
            relations: ['creator'],
            order: { createdAt: 'DESC' }
        });

        // Check if user has subscription to this creator
        let hasSubscription = false;
        if (userWallet) {
            hasSubscription = await this.subscriptionsService.isSubscriptionActive(creatorId, userWallet);
        }

        // Filter content based on access
        return contents.map(content => {
            if (content.price === 0 || hasSubscription) {
                return content;
            }
            return {
                ...content,
                fileUrl: null,
                locked: true
            };
        });
    }

    async getAllContent() {
        return await this.contentRepository.find({
            relations: ['creator'],
            order: { createdAt: 'DESC' }
        });
    }

    async updateContent(id: string, creatorId: string, updates: Partial<Content>) {
        const content = await this.contentRepository.findOne({
            where: { id },
            relations: ['creator']
        });

        if (!content) {
            throw new NotFoundException('Content not found');
        }

        if (content.creator.id !== creatorId) {
            throw new ForbiddenException('You can only update your own content');
        }

        Object.assign(content, updates);
        await this.contentRepository.save(content);
        return content;
    }

    async deleteContent(id: string, creatorId: string) {
        const content = await this.contentRepository.findOne({
            where: { id },
            relations: ['creator']
        });

        if (!content) {
            throw new NotFoundException('Content not found');
        }

        if (content.creator.id !== creatorId) {
            throw new ForbiddenException('You can only delete your own content');
        }

        await this.contentRepository.remove(content);
        return { message: 'Content deleted successfully' };
    }

    async checkContentAccess(creatorId: string, userWallet: string): Promise<boolean> {
        return await this.subscriptionsService.isSubscriptionActive(creatorId, userWallet);
    }

    async incrementViewCount(id: string) {
        const content = await this.contentRepository.findOne({ where: { id } });
        if (content) {
            content.viewCount += 1;
            await this.contentRepository.save(content);
        }
    }
}
