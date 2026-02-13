import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToOne, JoinColumn } from 'typeorm';
import { Creator } from '../creators/creators.entity';
import { Transaction } from 'src/transactions/transactions.entity';

@Entity()
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Creator)
  @JoinColumn()
  creator: Creator;

  @OneToOne(() => Transaction)
  @JoinColumn()
  transaction: Transaction;

  @Column()
  subscriberWallet: string;

  @Column()
  startedAt: Date;

  @Column()
  expiresAt: Date;

  @Column()
  status: string;
}