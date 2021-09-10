import { Schema, Document, Model, model, Types } from 'mongoose';
import Db from '@aitheon/core-server/dist/config/db';
import { JSONSchema } from 'class-validator-jsonschema';
import { IsString, IsEnum, IsNumber, IsMongoId, IsOptional, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { number } from '@aitheon/transporter';


export enum PriceType {
  ORGANIZATION = 'ORGANIZATION',
  PERSONAL = 'PERSONAL'
}



@JSONSchema({ description: 'PriceSetting' })
export class Price {

  @IsMongoId()
  @IsOptional()
  _id: string;

  @IsString()
  @IsOptional()
  service: string;

  @IsEnum(PriceType)
  @IsOptional()
  type: PriceType;

  @IsOptional()
  createdBy: any;

  @IsOptional()
  @IsDateString()
  startFrom: Date;


  @IsNumber()
  @IsOptional()
  pricePerSecond: number;

  @IsDateString()
  @IsOptional()
  createdAt: Date;

  @IsDateString()
  @IsOptional()
  updatedAt: Date;

}


const priceSchema = new Schema({

  service: String,

  type: {
    type: String,
    enum: Object.keys(PriceType),
    default: PriceType.ORGANIZATION
  },
  startFrom: Date,

  pricePerSecond: Number,

  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
    timestamps: true,
    collection: 'billing__prices'
  });


export type IPrice = Document & Price;
export const PriceSchema = Db.connection.model<IPrice>('Price', priceSchema);


