import {
  Table,
  Column,
  Model,
  DataType,
  CreatedAt,
  UpdatedAt,
} from 'sequelize-typescript';

export enum AdminRole {
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
}

export enum AdminStatus {
  ACTIVE = 'active',
  DISABLED = 'disabled',
}

@Table({
  tableName: 'admins',
  timestamps: true,
})
export class Admin extends Model<Admin> {
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
    validate: {
      isEmail: true,
    },
  })
  declare email: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
  })
  declare password: string;

  @Column({
    type: DataType.STRING(100),
    allowNull: false,
    field: 'first_name',
  })
  declare firstName: string;

  @Column({
    type: DataType.STRING(100),
    allowNull: false,
    field: 'last_name',
  })
  declare lastName: string;

  @Column({
    type: DataType.ENUM(...Object.values(AdminRole)),
    defaultValue: AdminRole.ADMIN,
  })
  declare role: AdminRole;

  @Column({
    type: DataType.ARRAY(DataType.STRING),
    defaultValue: [],
  })
  declare permissions: string[];

  @Column({
    type: DataType.ENUM(...Object.values(AdminStatus)),
    defaultValue: AdminStatus.ACTIVE,
  })
  declare status: AdminStatus;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'last_login_at',
  })
  declare lastLoginAt: Date;

  @Column({
    type: DataType.STRING(6),
    allowNull: true,
    field: 'password_change_otp',
  })
  declare passwordChangeOtp: string | null;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'password_change_otp_expires_at',
  })
  declare passwordChangeOtpExpiresAt: Date | null;

  @CreatedAt
  @Column({ field: 'created_at' })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ field: 'updated_at' })
  declare updatedAt: Date;
}

