import { Schema, Document, Connection } from 'mongoose';
import { JSONSchema } from 'class-validator-jsonschema';
import { IsString, IsMongoId, IsArray, ValidateNested, IsOptional, IsDate, IsEnum, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { SUBSCRIPTION_ITEM_TYPE, SUBSCRIPTION_ENTITIES } from './subscription.model';
import { objectIdStringGetter } from '../shared/helpers';

export enum PAYMENT_HISTORY_CREATED_BY_KIND {
  USER= 'USER',
  WORKER= 'WORKER'
}

export class PaymentHistoryCreatedBy {
  @IsEnum(PAYMENT_HISTORY_CREATED_BY_KIND)
  kind: PAYMENT_HISTORY_CREATED_BY_KIND;
  @IsMongoId()
  userId?: string;
}

export class InvoiceDocument {
  @IsOptional()
  @IsMongoId()
  _id: string;
  @IsOptional()
  @IsString()
  signedUrl: string;
}

export class PaymentCharges {
  @IsOptional()
  @IsEnum(SUBSCRIPTION_ITEM_TYPE)
  itemType: SUBSCRIPTION_ITEM_TYPE;

  @IsOptional()
  @IsMongoId()
  itemReference: string;

  @IsOptional()
  @IsNumber()
  itemPrice: number;

  @IsOptional()
  @IsNumber()
  finalPrice: number;

  @IsOptional()
  @IsNumber()
  quantity: number;

  @IsOptional()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  service: string;

  @IsOptional()
  @IsMongoId()
  suballocationId: string;

  @IsOptional()
  @IsNumber()
  billingInterval: number;

  @IsOptional()
  @IsArray()
  period: string[];

}

@JSONSchema({ description: 'PaymentHistory' })
export class PaymentHistory {

  @IsOptional()
  @IsMongoId()
  _id: string;

  @IsOptional()
  @IsArray({each: true})
  priceId: Array<string>;

  @IsOptional()
  @IsString()
  operationsId?: string;

  @IsOptional()
  @Type(() => Date)
  fromDate: Date;

  @IsOptional()
  @Type(() => Date)
  toDate: Date;

  @IsOptional()
  @ValidateNested({each: true})
  @Type(() => PaymentCharges)
  charges: PaymentCharges[];

  @IsOptional()
  @IsMongoId()
  entityReference: string;

  @IsOptional()
  @IsEnum(SUBSCRIPTION_ENTITIES)
  entity: SUBSCRIPTION_ENTITIES;

  @IsOptional()
  @IsNumber()
  totalBillAmount: number;

  @IsOptional()
  @IsString()
  currency: string;

  @IsOptional()
  @Type(() => PaymentHistoryCreatedBy)
  createdBy: PaymentHistoryCreatedBy;

  @IsOptional()
  @Type(() => InvoiceDocument)
  invoice?: InvoiceDocument;

  @IsOptional()
  transaction?: any;

}



const createdBySchema = new Schema({}, { discriminatorKey: 'kind', _id: false });

const paymentHistorySchema = new Schema({
  _id: {
    type: Schema.Types.ObjectId,
    auto: true,
    get: objectIdStringGetter
  },
  priceId: [{
    type: Schema.Types.ObjectId,
    get: objectIdStringGetter
  }],
  operationsId: {
    type: Schema.Types.ObjectId,
    get: objectIdStringGetter
  },
  fromDate: {
    type: Schema.Types.Date,
  },
  toDate: {
    type: Schema.Types.Date,
  },
  entity: {
    type: Schema.Types.String,
    enum: Object.keys(SUBSCRIPTION_ENTITIES),
    required: true
  },
  entityReference: {
    type: Schema.Types.ObjectId,
    get: objectIdStringGetter,
    required: true
  },
  totalBillAmount: {
    type: Schema.Types.Decimal128,
    required: true
  },
  currency: {
    type: Schema.Types.String,
    required: true
  },
  createdBy: {
    type: createdBySchema,
    required: true
  },
  invoice: {
    _id: {
      type: Schema.Types.ObjectId,
      get: objectIdStringGetter
    },
    signedUrl: {
      type: Schema.Types.String
    }
  },
  transaction: {
    type: Schema.Types.ObjectId,
    ref: 'FiatTransaction'
  },
  charges: [
    new Schema({
      _id: {
        type: Schema.Types.ObjectId,
        auto: true,
        get: objectIdStringGetter,
        required: true
      },
      itemPrice: {
        type: Schema.Types.Decimal128,
        required: true
      },
      finalPrice: {
        type: Schema.Types.Decimal128,
        required: true
      },
      itemType: {
        type: Schema.Types.String,
        enum: Object.keys(SUBSCRIPTION_ITEM_TYPE),
        required: true
      },
      itemReference: {
        type: Schema.Types.ObjectId,
        get: objectIdStringGetter,
        required: true
      },
      quantity: {
        type: Schema.Types.Number,
        required: true
      },
      name: {
        type: Schema.Types.String,
      },
      service: {
        type: Schema.Types.String,
        required: true
      },
      suballocationId: {
        type: Schema.Types.String
      },
      billingInterval: {
        type: Schema.Types.Number,
        required: true
      },
      period: [{
        type: Schema.Types.String,
      }]
    },
    {
      toObject: {getters: true},
      id: false
    })
  ]
}, {
    timestamps: true,
    collection: 'billing__payment_history',
    toObject: {getters: true},
    id: false
});

// @ts-ignore
paymentHistorySchema.path('createdBy').discriminator(PAYMENT_HISTORY_CREATED_BY_KIND.USER, new Schema({
  userId: Schema.Types.ObjectId
}, { _id: false }));

// @ts-ignore
paymentHistorySchema.path('createdBy').discriminator(PAYMENT_HISTORY_CREATED_BY_KIND.WORKER, new Schema({}, { _id: false }));

export type IPaymentHistory = Document & PaymentHistory;
export const GetPaymentHistorySchema = (connection: Connection) => connection.model<IPaymentHistory>('PaymentHistory', paymentHistorySchema);
