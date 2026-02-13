import { CanActivate, ExecutionContext, Injectable, HttpException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Content } from '../../content/content.entity';
import { Repository } from 'typeorm';
import { paymentMiddleware, STXtoMicroSTX } from 'x402-stacks';
import type { Request, Response } from 'express';

@Injectable()
export class X402Guard implements CanActivate {
  constructor(
    @InjectRepository(Content)
    private contentRepository: Repository<Content>
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const contentId = (request.params as any).id;

    if (!contentId) {
      throw new HttpException('Content ID missing', 400);
    }

    const content = await this.contentRepository.findOne({
      where: { id: contentId },
      relations: ['creator']
    });

    if (!content) {
      throw new HttpException('Content not found', 404);
    }

    // If content is free, allow access
    if (content.price === 0) {
      return true;
    }

    const NETWORK =
      (process.env.NETWORK as 'mainnet' | 'testnet') || 'testnet';

    const FACILITATOR_URL =
      process.env.FACILITATOR_URL ||
      'https://facilitator.stacksx402.com';

    const middleware = paymentMiddleware({
      amount: STXtoMicroSTX(content.price),
      payTo: content.creator.walletAddress,
      network: NETWORK,
      facilitatorUrl: FACILITATOR_URL,
    });

    return new Promise((resolve, reject) => {
      middleware(request as any, response as any, (err: any) => {
        console.log(request)
        if (err) {
          reject(
            new HttpException(
              err.message || 'Payment required',
              err.status || 402,
            ),
          );
        } else {
          resolve(true);
        }
      });
    });
  }
}