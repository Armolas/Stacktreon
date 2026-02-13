import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { X402Guard } from './x402.guard';
import { Content } from '../../content/content.entity';
import { Repository } from 'typeorm';

describe('X402Guard', () => {
  let guard: X402Guard;
  let contentRepository: Repository<Content>;

  const mockContentRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        X402Guard,
        {
          provide: getRepositoryToken(Content),
          useValue: mockContentRepository,
        },
      ],
    }).compile();

    guard = module.get<X402Guard>(X402Guard);
    contentRepository = module.get<Repository<Content>>(getRepositoryToken(Content));
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should have content repository injected', () => {
    expect(contentRepository).toBeDefined();
  });
});
