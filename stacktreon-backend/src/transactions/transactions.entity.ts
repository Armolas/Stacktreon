import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity()
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  payerWallet: string;

  @Column()
  creatorWallet: string;

  @Column({ nullable: true })
  contentId: string;

  @Column()
  type: string;

  @Column('decimal', { precision: 10, scale: 6 })
  amount: number;

  @Column({ nullable: true })
  txHash: string;

  @Column()
  status: string;

  @CreateDateColumn()
  createdAt: Date;
}