import { Schema, Document, Connection } from 'mongoose';
import { JSONSchema } from 'class-validator-jsonschema';
import { IsString, Min, Max, IsMongoId, ValidateNested, IsOptional, IsEnum, IsNumber } from 'class-validator';
import { Type, Expose } from 'class-transformer';
import { objectIdStringGetter } from '../shared/helpers';

export enum SUBSCRIPTION_BILLING_INTERVAL {
  MIN = 1,
  MAX = 12,
}

export enum SUBSCRIPTION_ITEM_TYPE {
  USER = 'USER',
  DEVICE = 'DEVICE',
  ROBOT = 'ROBOT',
  TAG = 'TAG',
  INFRASTRUCTURE = 'INFRASTRUCTURE',
  STORAGE = 'STORAGE'
}


export enum SUBSCRIPTION_STATUS {
  CANCELED = 'CANCELED',
  PAUSED = 'PAUSED',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  FROZEN = 'FROZEN',
}

export enum SUBSCRIPTION_ENTITIES {
  USER = 'USER',
  ORGANIZATION = 'ORGANIZATION',
}

export enum SUB_SUBSCRIPTION_ITEM_TYPES {
  SERVICE = 'SERVICE',
}

@JSONSchema({ description: 'SubSubscriptionItem' })
export class SubSubscriptionItem {

  @Expose()
  @IsOptional()
  @IsMongoId()
  _id: string;

  @Expose()
  @IsNumber()
  quantity: number;

  @Expose()
  @IsString()
  service: string;
}

@JSONSchema({ description: 'Subscription Item' })
export class SubscriptionItem {

  @Expose()
  @IsOptional()
  @IsMongoId()
  _id: string;

  @Expose()
  @IsNumber()
  quantity?: number;

  @Expose()
  @IsEnum(SUBSCRIPTION_ITEM_TYPE)
  itemType: SUBSCRIPTION_ITEM_TYPE;

  @Expose()
  @IsMongoId()
  @IsString()
  itemReference: string;

  @Expose()
  @IsNumber()
  @Min(SUBSCRIPTION_BILLING_INTERVAL.MIN)
  @Max(SUBSCRIPTION_BILLING_INTERVAL.MAX)
  billingInterval: number;

  @Expose()
  @IsString()
  @IsOptional()
  service?: string;

  @Expose()
  @Type(() => Date)
  @IsOptional()
  lastRenewDate: Date;

  @Expose()
  @IsOptional()
  @ValidateNested({each: true})
  @Type(() => SubSubscriptionItem)
  subAllocations: SubSubscriptionItem[];

}


@JSONSchema({ description: 'Subscription' })
export class Subscription {

  @Expose()
  @IsOptional()
  @IsMongoId()
  _id: string;

  @Expose()
  @IsString()
  service: string;

  @Expose()
  @IsEnum(SUBSCRIPTION_STATUS)
  status: SUBSCRIPTION_STATUS;

  @Expose()
  @IsEnum(SUBSCRIPTION_ENTITIES)
  entity: SUBSCRIPTION_ENTITIES;

  @Expose()
  @IsMongoId()
  entityReference: string;

  @Expose()
  @ValidateNested({each: true})
  @Type(() => SubscriptionItem)
  allocations: SubscriptionItem[];

  @Expose()
  @Type(() => Date)
  @IsOptional()
  createdAt: Date;

  @Expose()
  @Type(() => Date)
  @IsOptional()
  updatedAt: Date;


}
const subscriptionSchema = new Schema({
  _id: {
    type: Schema.Types.ObjectId,
    auto: true,
    get: objectIdStringGetter
  },
  service: {
    type: Schema.Types.String,
    required: true
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
  status: {
    type: Schema.Types.String,
    enum: Object.keys(SUBSCRIPTION_STATUS),
    required: true
  },
  allocations: [
    new Schema({
      service: {
        type: Schema.Types.String
      },
      _id: {
        type: Schema.Types.ObjectId,
        auto: true,
        get: objectIdStringGetter
      },
      quantity: {
        type: Schema.Types.Number,
        validate:
          function (value: any) {
              // @ts-ignore
              if (!this.service && typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
                return false;
              }
              return true;
          }
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
      billingInterval: {
        type: Number,
        min: SUBSCRIPTION_BILLING_INTERVAL.MIN,
        max: SUBSCRIPTION_BILLING_INTERVAL.MAX,
        default: SUBSCRIPTION_BILLING_INTERVAL.MIN
      },
      lastRenewDate: {
        type: Schema.Types.Date,
        required: true
      },
      subAllocations: [
        new Schema({
          _id: {
            type: Schema.Types.ObjectId,
            auto: true,
            get: objectIdStringGetter
          },
          service: {
            type: Schema.Types.String
          },
          quantity: {
            type: Schema.Types.Number,
            required: true
          },
          type: {
            type: Schema.Types.String,
            enum: Object.keys(SUB_SUBSCRIPTION_ITEM_TYPES)
          },
          reference: {
            type: Schema.Types.ObjectId,
            pathRef: 'allocations.subAllocations.type',
            get: objectIdStringGetter
          }
        }, {
          toObject: {getters: true},
          id: false,
          // @ts-ignore
          optimisticConcurrency: true
        })
      ]
    },
    {
      toObject: {getters: true},
      id: false
    })
  ]
},
{
  timestamps: true,
  collection: 'billing__subscriptions',
  toObject: {getters: true},
  id: false,
  // @ts-ignore
  optimisticConcurrency: true
});

const DOC_HOOKS = ['save'];
const QUR_HOOKS = ['findOneAndUpdate', 'update'];

DOC_HOOKS.forEach(function (dh) {
  // @ts-ignore
  subscriptionSchema.pre.call(subscriptionSchema, dh, function(next: any) {
    // @ts-ignore
    this.increment();
    return next();
  });
});

QUR_HOOKS.forEach(function (dh) {
  // @ts-ignore
  subscriptionSchema.pre.call(subscriptionSchema, dh, function(next: any) {
    // @ts-ignore
    this.update({}, { $inc: { __v: 1 } }, next );
  });
});

export type ISubscription = Document & Subscription;
export function GetSubscriptionSchema(connection: Connection) { return connection.model<ISubscription>('Subscription', subscriptionSchema); }
