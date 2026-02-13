import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity()
export class Creator {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  walletAddress: string;

  @Column()
  bns: string;

  @Column()
  displayName: string;

  @Column({ unique: true })
  username: string

  @Column('text')
  bio: string;

  @Column('text')
  about: string;

  @Column('simple-array', { nullable: true })
  categories: string[];

  @Column('decimal', { precision: 10, scale: 6 })
  subscriptionFee: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}