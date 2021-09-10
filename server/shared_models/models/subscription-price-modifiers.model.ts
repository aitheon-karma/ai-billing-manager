import { Schema, Document, Connection } from 'mongoose';
import { JSONSchema } from 'class-validator-jsonschema';
import { IsString, IsMongoId, ValidateNested, IsOptional, IsEnum, IsNumber, Min, Max, IsAlpha, IsArray, ArrayMinSize } from 'class-validator';
import { SUBSCRIPTION_ENTITIES, SUBSCRIPTION_ITEM_TYPE, SUBSCRIPTION_BILLING_INTERVAL } from './subscription.model';
import { SUBSCRIPTION_ITEM_PRICING_STRATEGY, SUBSCRIPTION_ITEM_PRICE_RANGES, IsValidPricingStrategy, PricingStrategyConstraint, SubscriptionItemPriceStrategyQuantity } from './subscription-price.model';
import { Type, Expose } from 'class-transformer';
import { objectIdStringGetter } from '../shared/helpers';

@JSONSchema({ description: 'SubscriptionItemPriceModifier' })
export class SubscriptionItemPriceModifier {

  @Expose()
  @IsValidPricingStrategy({message: PricingStrategyConstraint.message})
  itemPrice: SubscriptionItemPriceStrategyQuantity;

  @Expose()
  @IsEnum(SUBSCRIPTION_ITEM_TYPE)
  itemType: SUBSCRIPTION_ITEM_TYPE;

  @Expose()
  @IsMongoId()
  itemReference?: string;

  @Expose()
  @IsNumber()
  @Min(SUBSCRIPTION_BILLING_INTERVAL.MIN)
  @Max(SUBSCRIPTION_BILLING_INTERVAL.MAX)
  billingInterval?: number;

  @Expose()
  @IsString()
  currency: string;

  @Expose()
  @ValidateNested({each: true})
  @Type(() => String)
  usableBy: Array<string>;

}

@JSONSchema({ description: 'SubscriptionPriceModifier' })
export class SubscriptionPriceModifier {

  @Expose()
  @IsOptional()
  _id: string;

  @Expose()
  @IsArray({ each: true })
  @ArrayMinSize(1)
  @ValidateNested({each: true})
  items: SubscriptionItemPriceModifier[];

  @Expose()
  @IsString()
  service: string;

  @Expose()
  @IsOptional()
  @IsEnum(SUBSCRIPTION_ENTITIES)
  entity: SUBSCRIPTION_ENTITIES;

  @Expose()
  @IsOptional()
  @IsMongoId()
  entityReference: string;

  @Expose()
  @IsString()
  description: string;

  @Expose()
  @Type(() => Date)
  startDate: Date;

  @Expose()
  @Type(() => Date)
  endDate: Date;

}


const subscriptionPriceModifier = new Schema({
  _id: {
    type: Schema.Types.ObjectId,
    auto: true,
    get: objectIdStringGetter
  },
  entity: {
    type: Schema.Types.String,
    enum: Object.keys(SUBSCRIPTION_ENTITIES),
  },
  entityReference: {
    type: Schema.Types.ObjectId,
    get: objectIdStringGetter
  },
  items: [
    new Schema({
      _id: {
        type: Schema.Types.ObjectId,
        auto: true,
        get: objectIdStringGetter
      },
      itemPrice: {
        ranges: [Schema.Types.Number],
        prices: [Schema.Types.Mixed],
        inclusivity: {
          type: Schema.Types.String,
          // @ts-ignore
          enum: Object.keys(SUBSCRIPTION_ITEM_PRICE_RANGES).map((k) => SUBSCRIPTION_ITEM_PRICE_RANGES[k as any])
        },
        type: {
          type: Schema.Types.String,
          enum: Object.keys(SUBSCRIPTION_ITEM_PRICING_STRATEGY)
        },
        price: Schema.Types.Number
      },
      itemType: {
        type: Schema.Types.String,
        enum: Object.keys(SUBSCRIPTION_ITEM_TYPE),
        required: true
      },
      itemReference: {
        type: Schema.Types.ObjectId,
        get: objectIdStringGetter
      },
      billingInterval: {
        type: Number,
        min: SUBSCRIPTION_BILLING_INTERVAL.MIN,
        max: SUBSCRIPTION_BILLING_INTERVAL.MAX,
        default: SUBSCRIPTION_BILLING_INTERVAL.MIN
      },
      currency: {
        type: Schema.Types.String,
        default: 'USD'
      },
      usableBy: [
        {type: Schema.Types.String}
      ],
    },
    {
      toObject: {getters: true},
      id: false
    })
  ],
  service: {
    type: Schema.Types.String,
    required: true
  },
  description: {
    type: Schema.Types.String
  },
  startDate: {
    type: Schema.Types.Date,
    required: true
  },
  endDate: {
    type: Schema.Types.Date,
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    get: objectIdStringGetter
  }
}, {
    timestamps: true,
    collection: 'billing__subscription_prices_modifiers',
    toObject: {getters: true},
    id: false
});

export type ISubscriptionPriceModifier = Document & SubscriptionPriceModifier;
export function GetSubscriptionPriceModifierSchema(connection: Connection) { return connection.model<ISubscriptionPriceModifier>('SubscriptionPriceModifier', subscriptionPriceModifier); }
