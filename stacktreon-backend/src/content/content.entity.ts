import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Creator } from '../creators/creators.entity';

@Entity()
export class Content {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Creator)
  @JoinColumn()
  creator: Creator;

  @Column()
  title: string;

  @Column('text')
  description: string;

  @Column()
  contentType: string;

  @Column()
  fileUrl: string;

  @Column('decimal', { precision: 10, scale: 6 })
  price: number;

  @Column({ default: 0 })
  viewCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}