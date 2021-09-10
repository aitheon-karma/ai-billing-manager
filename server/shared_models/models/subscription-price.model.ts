import { Schema, Document, Connection } from 'mongoose';
import { JSONSchema } from 'class-validator-jsonschema';
import { IsString, IsArray, Equals, Min, Max, IsMongoId, ValidateNested, IsOptional, IsDateString, IsEnum, IsNumber, ArrayMinSize } from 'class-validator';
import { Type, Expose } from 'class-transformer';
import { SUBSCRIPTION_ENTITIES, SUBSCRIPTION_ITEM_TYPE, SUBSCRIPTION_BILLING_INTERVAL, Subscription } from './subscription.model';
import { registerDecorator, ValidationArguments, ValidationOptions, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import { isValidInstance, objectIdStringGetter } from '../shared/helpers';

function isSorted(arr: Array<number>) {
  for (let i = 0, l = arr.length; i < l; i++) {
    if ((i + 1) < l) {
      if (arr[i] > arr[i + 1]) {
        return false;
      }
    }
  }
  return true;
}

export function IsValidRange(property: string, validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'IsValidRange',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [property, RangeConstraint],
      options: validationOptions,
      validator: RangeConstraint
    });
  };
}

export function IsValidPrices(property: string, validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'IsValidPrices',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [property],
      options: validationOptions,
      validator: PriceConstraint
    });
  };
}

@ValidatorConstraint({name: 'RangeConstraint', async: true})
export class RangeConstraint implements ValidatorConstraintInterface {

    async validate(value: Array<number>, args: ValidationArguments) {
      if (Array.isArray(value) !== true || value.length < 1) {
        return false;
      }
      const [relatedPropertyName] = args.constraints;
      const relatedValue = (args.object as any)[relatedPropertyName];
      if (Array.isArray(relatedValue) !== true || relatedValue.length !== value.length) {
        return false;
      }
      if (isSorted(value) !== true) {
        return false;
      }
      return true;
    }

    static message(args: ValidationArguments) { return `Property (${args.property}) of (${args.targetName}) must be an *array of *sorted *numbers and *length must be the same as (${args.constraints[0]}) property *length`; }

}

@ValidatorConstraint({name: 'PriceConstraint', async: true})
export class PriceConstraint implements ValidatorConstraintInterface {

    async validate(value: Array<Array<number>>, args: ValidationArguments) {
      if (Array.isArray(value) !== true || value.length < 1) {
        return false;
      }
      const [relatedPropertyName] = args.constraints;
      const relatedValue = (args.object as any)[relatedPropertyName];
      if (Array.isArray(relatedValue) !== true || relatedValue.length !== value.length) {
        return false;
      }
      for (let i = 0, l = value.length; i < l; i++) {
        if (Array.isArray(value[i]) !== true) {
          return false;
        }
        for (let o = 0, p = value[i].length; o < p; o++) {
          if (typeof value[i][o] !== 'number' || Number.isFinite(value[i][o]) !== true) {
            return false;
          }
        }
        if (isSorted(value[i]) !== true) {
          return false;
        }
      }
      return true;
    }

    static message(args: ValidationArguments) { return `Property (${args.property}) of (${args.targetName}) must be an *array of *arrays of *sorted *numbers and *length must be the same as (${args.constraints[0]}) property *length`; }

}

@ValidatorConstraint({name: 'PricingStrategyConstraint', async: true})
export class PricingStrategyConstraint implements ValidatorConstraintInterface {

    async validate(value: SubscriptionItemPriceStrategyQuantity, args: ValidationArguments) {
        await isValidInstance(SubscriptionItemPriceStrategyQuantity, value);
        return true;
    }

    static message(args: ValidationArguments) { return `Property (${args.property}) of (${args.targetName}) must be a valid pricing strategy`; }

}


export function IsValidPricingStrategy(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isValidPricingStrategy',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [],
      validator: PricingStrategyConstraint,
      async: true
    });
  };
}



export enum SUBSCRIPTION_ITEM_PRICE_RANGES {
  IE = '[)',
}

export enum SUBSCRIPTION_ITEM_PRICING_STRATEGY {
  QUANTITY = 'QUANTITY',
}

function checkNumber(c: any) {
  return typeof c === 'number' && Number.isFinite(c) === true;
}

@JSONSchema({ description: 'SubscriptionItemPriceStrategyQuantity' })
export class SubscriptionItemPriceStrategyQuantity {


  @Expose()
  @Equals(SUBSCRIPTION_ITEM_PRICING_STRATEGY.QUANTITY)
  type: string;

  @Expose()
  @ArrayMinSize(1)
  @IsValidRange('prices', {message: RangeConstraint.message})
  ranges: Array<number>;

  @Expose()
  @IsArray({ each: true })
  @ArrayMinSize(1)
  @IsValidPrices('ranges', {message: PriceConstraint.message})
  prices: number[][];

  @Expose()
  @IsEnum(SUBSCRIPTION_ITEM_PRICE_RANGES)
  inclusivity: SUBSCRIPTION_ITEM_PRICE_RANGES;

  @Expose()
  getPrice(n: number): number {
    if (
      !this.ranges
      || !Array.isArray(this.ranges)
      || !this.prices
      || !Array.isArray(this.prices)
      || (this.ranges.length > 0 && this.prices.length > this.ranges.length)
      || (this.ranges.length === 0 && this.prices.length !== 1)
    ) {
      throw new Error('Corrupted price entry');
    }
    if (typeof n !== 'number' || !Number.isFinite(n)) {
      throw new Error('Quantity is not a number');
    }
    if (n === 0) {
      return 0;
    }
    let price: number;
    if (this.ranges.length === 0) {
      if (typeof this.prices[0] !== 'number') {
        throw new Error('Could not retrieve price: price is not a number');
      }
      price = (this.prices as Array<any>)[0];
    }
    switch (this.inclusivity) {
      case SUBSCRIPTION_ITEM_PRICE_RANGES.IE: {
        this.ranges.sort((a, b) => a <= b ? -1 : 1);
        range: for (let i = 0, l = this.ranges.length; i < l; i++) {
          if (this.ranges[i] <= n && ((i + 1) === this.ranges.length || ((i + 1) !== this.ranges.length && n < this.ranges[i + 1]))) {
            if (this.prices[i].length === 1) {
              if (checkNumber(this.prices[i][0]) !== true) {
                throw new Error('Could not retrieve price: price is not a number');
              }
              price = this.prices[i][0];
            } else if (Array.isArray(this.prices[i]) && this.prices[i].length === 2) {
              const [min, max] = this.prices[i].sort((a, b) => a <= b ? -1 : 1);
              const rangeLower = this.ranges[i];
              const rangeHigher = this.ranges[i + 1] - 1 || Infinity;
              if (!checkNumber(min) || !checkNumber(max) || !checkNumber(rangeLower) || !checkNumber(rangeHigher)) {
                throw new Error('Could not retrieve price: price is not a number');
              }
              price = (max - (((max - min) / (rangeHigher - rangeLower)) * (n - rangeLower)));
            }
            break range;
          }
        }
        break;
      }
      default: {
        throw new Error('Not implemented inclusivity range type');
      }
    }
    // @ts-ignore
    if (!price) {
      throw new Error('Could not derive price for range');
    }
    return price;
  }
}

@JSONSchema({ description: 'SubscriptionItemPrice' })
export class SubscriptionItemPrice {

  @Expose()
  @IsMongoId()
  @IsOptional()
  _id: string;

  @Expose()
  @IsValidPricingStrategy({message: PricingStrategyConstraint.message})
  itemPrice: SubscriptionItemPriceStrategyQuantity;

  @Expose()
  @IsNumber()
  @Min(SUBSCRIPTION_BILLING_INTERVAL.MIN)
  @Max(SUBSCRIPTION_BILLING_INTERVAL.MAX)
  billingInterval: number;

  @Expose()
  @IsEnum(SUBSCRIPTION_ITEM_TYPE)
  itemType: SUBSCRIPTION_ITEM_TYPE;

  @Expose()
  @IsMongoId()
  @IsString()
  itemReference: string;

  @Expose()
  @IsString()
  currency: string;

  @Expose()
  @ValidateNested({each: true})
  @Type(() => String)
  usableBy: Array<string>;

}

@JSONSchema({ description: 'SubscriptionPrice' })
export class SubscriptionPrice {

  @Expose()
  @IsMongoId()
  @IsOptional()
  _id: string;

  @Expose()
  @IsString()
  service: string;

  @Expose()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({each: true, always: true})
  @Type(() => SubscriptionItemPrice)
  items: SubscriptionItemPrice[];

  @Expose()
  @Type(() => Date)
  startDate: Date;

  @Expose()
  @Type(() => Date)
  @IsOptional()
  createdAt: Date;

  @Expose()
  @Type(() => Date)
  @IsOptional()
  updatedAt: Date;

  @Expose()
  @IsMongoId()
  @IsOptional()
  createdBy: string;

}


const subscriptionPriceSchema = new Schema({
  _id: {
    type: Schema.Types.ObjectId,
    auto: true,
    get: objectIdStringGetter
  },
  service: {
    type: Schema.Types.String,
    required: true
  },
  items: [
    new Schema({
      itemPrice: {
        ranges: [{type: Schema.Types.Number, required: true}],
        prices: [{type: Schema.Types.Mixed, required: true}],
        inclusivity: {
          type: Schema.Types.String,
          // @ts-ignore
          enum: Object.keys(SUBSCRIPTION_ITEM_PRICE_RANGES).map((k) => SUBSCRIPTION_ITEM_PRICE_RANGES[k as any]),
          required: true
        },
        type: {
          type: Schema.Types.String,
          enum: Object.keys(SUBSCRIPTION_ITEM_PRICING_STRATEGY),
          required: true
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
      usableBy: [
        {type: Schema.Types.String}
      ],
      billingInterval: {
        type: Number,
        min: SUBSCRIPTION_BILLING_INTERVAL.MIN,
        max: SUBSCRIPTION_BILLING_INTERVAL.MAX,
        default: SUBSCRIPTION_BILLING_INTERVAL.MIN,
        required: true
      },
      currency: {
        type: Schema.Types.String,
        default: 'USD',
        required: true
      }
    },
    {
      toObject: {getters: true},
      id: false
    })
  ],
  startDate: {
    type: Schema.Types.Date,
    required: true
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    get: objectIdStringGetter,
    required: true
  }
}, {
    timestamps: true,
    collection: 'billing__subscription_prices',
    toObject: {getters: true},
    id: false
});


export type ISubscriptionPrice = Document & SubscriptionPrice;
export function GetSubscriptionPriceSchema(connection: Connection) { return connection.model<ISubscriptionPrice>('SubscriptionPrice', subscriptionPriceSchema); }
