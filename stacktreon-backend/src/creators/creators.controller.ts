import {
  Controller,
  Post,
  Body,
  Get,
  Param,
} from '@nestjs/common';
import { CreatorsService } from './creators.service';
import { RegisterCreatorDto } from './dto/register-creator.dto';

@Controller('creators')
export class CreatorsController {
    constructor (
        private readonly creatorsService: CreatorsService
    ){}

    @Post('register')
    async register(@Body() dto: RegisterCreatorDto){
        return this.creatorsService.registerCreator(dto.username, dto.displayName, dto.walletAddress, dto.bns, dto.subscriptionFee, dto.bio, dto.about, dto.categories);
    }

    @Get()
    async getAllCreators(){
        return await this.creatorsService.getAllCreators();
    }

    @Get('wallet/:walletAddress')
    async getCreatorByWallet(@Param('walletAddress') walletAddress: string){
        return await this.creatorsService.getCreatorByWalletAddress(walletAddress);
    }

    @Get('username/:username')
    async getCreatorByUsername(@Param('username') username: string){
        return await this.creatorsService.getCreatorByUsername(username);
    }

    @Get(':id')
    async getCreatorById(@Param('id') id: string){
        return await this.creatorsService.getCreatorById(id);
    }
}
