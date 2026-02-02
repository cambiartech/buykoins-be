import {
  Table,
  Column,
  Model,
  DataType,
  CreatedAt,
  UpdatedAt,
} from 'sequelize-typescript';

export enum FundingSourceType {
  ACCOUNT = 'account',
  CARD = 'card',
  BANK = 'bank',
}

export enum FundingSourceStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

@Table({
  tableName: 'funding_sources',
  timestamps: true,
})
export class FundingSource extends Model<FundingSource> {
  @Column({
    type: DataType.UUID,
    primaryKey: true,
    defaultValue: DataType.UUIDV4,
  })
  declare id: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
    unique: true,
    field: 'sudo_funding_source_id',
  })
  declare sudoFundingSourceId: string;

  @Column({
    type: DataType.ENUM(...Object.values(FundingSourceType)),
    allowNull: false,
  })
  declare type: FundingSourceType;

  @Column({
    type: DataType.STRING(10),
    allowNull: false,
    defaultValue: 'NGN',
  })
  declare currency: string;

  @Column({
    type: DataType.ENUM(...Object.values(FundingSourceStatus)),
    defaultValue: FundingSourceStatus.ACTIVE,
  })
  declare status: FundingSourceStatus;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare metadata: Record<string, any> | null;

  @CreatedAt
  @Column({ field: 'created_at' })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ field: 'updated_at' })
  declare updatedAt: Date;
}

