import { Schema, Document, Model, model, Types } from 'mongoose';
import Db from '@aitheon/core-server/dist/config/db';
import { JSONSchema } from 'class-validator-jsonschema';
import { IsString, IsNotEmpty, IsEnum, IsNumber, ValidateNested, IsMongoId, IsDate, IsDefined, IsOptional, Min, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';


/**
 * Keep enums as string for better read
 */
export enum FiatTransactionType {
  OUTBOUND = 'OUTBOUND',
  INBOUND = 'INBOUND',
}

/**
 * Keep enums as string for better read
 */
export enum FiatTransactionStatus {
  CREATED = 'CREATED',
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  TIMEOUT = 'TIMEOUT'
}


export enum FiatTransactionApprovalStatus {
  PENDING = 'PENDING',
  USER_APPROVED = 'USER_APPROVED',
  ADMIN_APPROVED = 'ADMIN_APPROVED',
  USER_REJECTED = 'USER_REJECTED',
  ADMIN_REJECTED = 'ADMIN_REJECTED'
}

export class FaitAccountSourceAdditionalInfo {

  @IsString()
  @IsOptional()
  name: string;

  @IsString()
  @IsOptional()
  value: string;
}

export class FiatTransactionSource {

  @IsString()
  @IsOptional()
  service: string;

  @IsString()
  @IsOptional()
  module: string;

  @IsOptional()
  user: any;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FaitAccountSourceAdditionalInfo)
  @JSONSchema({ description: 'Additional information from the service' })
  additionalInfo: Array<FaitAccountSourceAdditionalInfo>;

  @IsOptional()
  organization: any;

}

/***
 * Example Type. Data Transfer object type
 */
@JSONSchema({ description: 'Fiat Transactions' })
export class FiatTransaction {

  @IsMongoId()
  @IsOptional()
  _id: string;

  @IsEnum(FiatTransactionType)
  @JSONSchema({ description: 'Type of fiat transaction' })
  type: FiatTransactionType;

  @IsNumber()
  amount: number;

  @IsString()
  @IsOptional()
  description: string;

  @IsOptional()
  user: any;

  @IsOptional()
  organization: any;

  @ValidateNested()
  @IsOptional()
  @Type(() => FiatTransactionSource)
  source: FiatTransactionSource;


  @IsEnum(FiatTransactionApprovalStatus)
  @IsOptional()
  @JSONSchema({ description: 'Fiat transaction approval status' })
  approvalStatus: FiatTransactionApprovalStatus;

  @IsOptional()
  approvedBy: any;

  @IsOptional()
  account: any;

  @IsEnum(FiatTransactionStatus)
  @IsOptional()
  @JSONSchema({ description: 'Fiat transaction status' })
  status: FiatTransactionStatus;


  @IsOptional()
  errorMessage: any;

  @IsOptional()
  @IsNumber()
  group: number;

  @IsOptional()
  data: any;

  @IsOptional()
  batch: any;

  @IsOptional()
  createdBy: any;

  @IsDateString()
  @IsOptional()
  createdAt: Date;

  @IsDateString()
  @IsOptional()
  updatedAt: Date;
}



/**
 * Database schema/collection
 */
const fiatTransactionSchema = new Schema({
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },

  user: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  organization: {
    type: Schema.Types.ObjectId,
    ref: 'Organization'
  },

  source: {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    organization: {
      type: Schema.Types.ObjectId,
      ref: 'Organization'
    },
    service: {
      type: String,
    },
    module: {
      type: String
    },

    additionalInfo: [
      {
        name: { type: String },
        value: { type: String }
      }
    ]
  },

  account: {
    type: Schema.Types.ObjectId,
    ref: 'FiatAccount'
  },

  batch: {
    type: Schema.Types.ObjectId,
    ref: 'Batch'
  },

  type: {
    type: String,
    enum: Object.keys(FiatTransactionType)
  },

  description: {
    type: String,
    maxlength: 512
  },

  errorMessage: Schema.Types.Mixed,

  amount: Number,

  status: {
    default: FiatTransactionStatus.CREATED,
    type: String,
    enum: Object.keys(FiatTransactionStatus)
  },

  approvalStatus: {
    default: FiatTransactionApprovalStatus.PENDING,
    type: String,
    enum: Object.keys(FiatTransactionApprovalStatus)
  },

  data: {},
  group: {
    type: Number
  }
},
  {
    timestamps: true,
    collection: 'treasury__fiat-transactions'
  });

export type IFiatTransaction = Document & FiatTransaction;
export const FiatTransactionSchema = Db.connection.model<IFiatTransaction>('FiatTransaction', fiatTransactionSchema);
