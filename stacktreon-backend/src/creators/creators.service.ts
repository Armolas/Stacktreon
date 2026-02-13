import {
  Injectable,
  ConflictException,
  NotFoundException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository} from 'typeorm';
import { Creator } from './creators.entity';


@Injectable()
export class CreatorsService {
    constructor(
        @InjectRepository(Creator)
        private creatorRepository: Repository<Creator>
    ){}

    async registerCreator(
        username: string,
        displayName: string,
        walletAddress: string,
        bns: string,
        subscriptionFee: number,
        bio: string,
        about: string,
        categories?: string[]
    ){
        const existing = await this.creatorRepository.findOne({where: {walletAddress}})
        if (existing) {
            throw new ConflictException('Creator with this wallet address already exists');
        }

        const creator = this.creatorRepository.create({
            walletAddress,
            bns,
            displayName,
            username,
            bio,
            about,
            subscriptionFee,
            categories
        })
        await this.creatorRepository.save(creator)

        return creator
    }

    async getCreatorByWalletAddress(walletAddress: string){
        const creator = await this.creatorRepository.findOne({where: {walletAddress}});
        if (!creator) {
            throw new NotFoundException("Creator with wallet address does not exist yet!")
        }
        return creator;
    }

    async getCreatorById(id: string){
        const creator = await this.creatorRepository.findOne({where: {id}});
        if (!creator) {
            throw new NotFoundException("Creator with id does not exist!")
        }
        return creator;
    }

    async getCreatorByUsername(username: string){
        const creator = await this.creatorRepository.findOne({where: {username}});
        if (!creator) {
            throw new NotFoundException("Creator with username does not exist!")
        }
        return creator;
    }

    async getAllCreators(){
        return await this.creatorRepository.find();
    }
}
