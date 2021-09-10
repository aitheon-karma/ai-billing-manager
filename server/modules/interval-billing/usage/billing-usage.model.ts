
import { Schema, Document, Model, model, Types } from 'mongoose';
import { JSONSchema } from 'class-validator-jsonschema';
import { IsString, IsNotEmpty, IsEnum, IsNumber, ValidateNested, IsMongoId, IsDate, IsDefined, IsOptional, Min, IsDateString, IsArray, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import Db from '@aitheon/core-server/dist/config/db';


export class Billing {

  @IsBoolean()
  @IsOptional()
  charged: boolean;

  @IsNumber()
  @IsOptional()
  total: number;

  @IsNumber()
  @IsOptional()
  pricePerSecond: number;
}


@JSONSchema({ description: 'Schema for billing usage' })
export class BillingUsage {

  @IsMongoId()
  @IsString()
  _id: string;



  @Type(() => Object)
  @IsOptional()
  user: any;

  @IsOptional()
  organization: any;

  @IsOptional()
  @IsString()
  service: string;

  @IsOptional()
  @ValidateNested()
  billing: Billing;

  @IsOptional()
  @IsString()
  serviceType: string;

  @IsOptional()
  @IsDateString()
  requestTime: Date;

  @IsOptional()
  @IsDateString()
  usageByTime: Date;

  @IsDateString()
  @IsOptional()
  createdAt: Date;

  @IsDateString()
  @IsOptional()
  updatedAt: Date;

}


const billingUsageSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  organization: {
    type: Schema.Types.ObjectId,
    ref: 'Organization'
  },
  service: String,
  serviceType: String,
  requestTime: Date,
  usageByTime: Date,
  billing: {
    charged: {
      type: Boolean,
      default: false
    },
    total: Number,
    pricePerSecond: Number
  }
}, {
  timestamps: true,
  collection: 'billing__usage'
});


 export type IBillingUsage = Document & BillingUsage;
 export const BillingUsageSchema = Db.connection.model<IBillingUsage>('BillingUsage', billingUsageSchema);
