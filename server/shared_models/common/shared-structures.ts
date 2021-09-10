import {
  SubscriptionItemPrice,
  SUBSCRIPTION_ENTITIES,
  ISubscriptionPriceModifier,
  ISubscription,
  SubscriptionItem,
  SubscriptionPriceModifier,
  UpdateOperation,
  SUBSCRIPTION_ITEM_TYPE,
  ISubscriptionPrice,
  IPaymentHistory,
  ISubscriptionOperations,
  IOrganization,
  SUBSCRIPTION_BILLING_INTERVAL
} from '../index';
import { IsString, Min, Max, IsMongoId, ValidateNested, IsOptional, IsEnum, IsNumber, IsDateString } from 'class-validator';
import { Type, Expose } from 'class-transformer';
import { Model } from 'mongoose';
import { JSONSchema } from 'class-validator-jsonschema';

export class Models {
  SubscriptionModel: Model<ISubscription>;
  SubscriptionPriceModel: Model<ISubscriptionPrice>;
  SubscriptionPriceModifierModel: Model<ISubscriptionPriceModifier>;
  PaymentHistoryModel: Model<IPaymentHistory>;
  SubscriptionOperationsModel: Model<ISubscriptionOperations>;
  OrganizationModel: Model<IOrganization>;
}

@JSONSchema({ description: 'SubscriptionUpdateAllocationPayload' })
export class SubscriptionUpdateAllocationPayload {
  @Expose()
  @IsEnum(SUBSCRIPTION_ITEM_TYPE)
  itemType: SUBSCRIPTION_ITEM_TYPE;

  @Expose()
  @IsMongoId()
  itemReference: string;

  @Expose()
  @IsString()
  @IsOptional()
  service: string;

  @Expose()
  @IsString()
  @IsOptional()
  allocationId?: string;

  @Expose()
  @IsNumber()
  @Min(SUBSCRIPTION_BILLING_INTERVAL.MIN)
  @Max(SUBSCRIPTION_BILLING_INTERVAL.MAX)
  billingInterval: number;

  @Expose()
  @IsNumber()
  changedQuantity: number;

  @Expose()
  @IsNumber()
  oneTimePrice: number;

  @Expose()
  @IsNumber()
  oneTimePriceWithModifier: number;

  @Expose()
  @IsNumber()
  pricePerQuantity: number;

  @Expose()
  @IsNumber()
  totalPrice: number;

  @Expose()
  @IsNumber()
  totalQuantity: number;
}

@JSONSchema({ description: 'SubscriptionUpdatePayload' })
export class SubscriptionUpdatePayload {
  @Expose()
  @IsString()
  service: string;

  @Expose()
  @ValidateNested({ each: true })
  @Type(() => SubscriptionUpdateAllocationPayload)
  allocations: SubscriptionUpdateAllocationPayload[];

  @Expose()
  @IsNumber()
  subscriptionTotalPrice: number;

  @Expose()
  @IsNumber()
  updateOneTimeTotalPrice: number;

  @Expose()
  @IsMongoId()
  accountId: string;
}

export enum SUBSCRIPTION_PROCESSING_STATES {
  INITIAL = 'INITIAL',
  RESOLVED_PRICES = 'RESOLVED_PRICES',
  CALCULATED_VALUES = 'CALCULATED_VALUES',
  UPDATE_OPERATIONS = 'UPDATE_OPERATIONS',
}

export class ResolvedSuballocations {
  [key: string]: SubscriptionItem
}

export class CalculatedForAllocations {
  total: number;
  allocations: {
    [key: string]: {
      calculatedOne: number,
      calculatedTotal: number,
      calculatedQuantity: number,
      suballocationId?: string,
      itemType: SUBSCRIPTION_ITEM_TYPE,
      itemReference: string,
      billingInterval: number,
      period?: string[]
    }
  };
}

export class ProcessingSubscriptionItemPrice {
  @Expose()
  @IsOptional()
  __buster?: any;
  [key: string]: SubscriptionItemPrice & {service?: string};
}

export interface SubscriptionProcessingStateInterface {
  getCalculatedValues: () => CalculatedForAllocations;
  getResolvedPrices: () => ProcessingSubscriptionItemPrice;
  getUpdateOperations: () => UpdateOperation[];
  readonly state: SUBSCRIPTION_PROCESSING_STATES;
}

export class SubscriptionProcessingResolved implements SubscriptionProcessingStateInterface {
  @Expose()
  @ValidateNested()
  @Type(() => ProcessingSubscriptionItemPrice)
  resolvedPrices: ProcessingSubscriptionItemPrice;

  readonly state = SUBSCRIPTION_PROCESSING_STATES.RESOLVED_PRICES;

  getCalculatedValues(): CalculatedForAllocations {throw new Error('getCalculatedValues called on a wrong state'); }
  getResolvedPrices() {return this.resolvedPrices; }
  getUpdateOperations(): UpdateOperation[] {throw new Error('getUpdateOperations called on a wrong state'); }
}

export class SubscriptionProcessingCalculated implements SubscriptionProcessingStateInterface {
  @Expose()
  @ValidateNested()
  @Type(() => ProcessingSubscriptionItemPrice)
  resolvedPrices: ProcessingSubscriptionItemPrice;

  calculated: CalculatedForAllocations;

  readonly state = SUBSCRIPTION_PROCESSING_STATES.CALCULATED_VALUES;

  getCalculatedValues(): CalculatedForAllocations {return this.calculated; }
  getResolvedPrices() {return this.resolvedPrices; }
  getUpdateOperations(): UpdateOperation[] {throw new Error('getUpdateOperations called on a wrong state'); }
}

export class SubscriptionProcessingUpdateFormed implements SubscriptionProcessingStateInterface {
  @Expose()
  @ValidateNested()
  @Type(() => ProcessingSubscriptionItemPrice)
  resolvedPrices: ProcessingSubscriptionItemPrice;

  updateOperations: UpdateOperation[];

  calculated: CalculatedForAllocations;

  readonly state = SUBSCRIPTION_PROCESSING_STATES.UPDATE_OPERATIONS;

  getCalculatedValues(): CalculatedForAllocations {return this.calculated; }
  getResolvedPrices() {return this.resolvedPrices; }
  getUpdateOperations(): UpdateOperation[] {return this.updateOperations; }
}

export class ApplicablePrice {
  @Expose()
  @IsString()
  _id: string;
  @Expose()
  @IsMongoId()
  priceId: string;
  @Expose()
  @ValidateNested({each: true})
  @Type(() => SubscriptionItemPrice)
  items: Array<SubscriptionItemPrice>;
  @Expose()
  @IsString()
  service: string;
  @Expose()
  @IsDateString()
  startDate: string;
}

class SubscriptionItemMapById {
  [key: string]: SubscriptionItem;
}

export class SubscriptionProcessingContext {
  @Expose()
  @IsString()
  subscriptionId?: string;
  @Expose()
  @IsString()
  service: string;
  @Expose()
  @IsEnum(SUBSCRIPTION_ENTITIES)
  entity: SUBSCRIPTION_ENTITIES;
  @Expose()
  @IsString()
  entityReference: string;
  @Expose()
  @Type(() => SubscriptionItemMapById)
  allocations: SubscriptionItemMapById;

  @Expose()
  @ValidateNested({each: true})
  @Type(() => SubscriptionUpdatePayload)
  update?: SubscriptionUpdatePayload;

  @Expose()
  @Type(() => ResolvedSuballocations)
  resolvedSuballocations: ResolvedSuballocations;

  @Expose()
  @ValidateNested({each: true})
  @Type(() => ApplicablePrice)
  prices: ApplicablePrice[];
  @Expose()
  @ValidateNested({each: true})
  @Type(() => SubscriptionPriceModifier)
  modifiers: SubscriptionPriceModifier[];

  changeState(state: SubscriptionProcessingStateInterface) {
    this.state = state;
  }
  state: SubscriptionProcessingStateInterface;
  get currentState(): SUBSCRIPTION_PROCESSING_STATES {
    return this.state ? this.state.state : SUBSCRIPTION_PROCESSING_STATES.INITIAL;
  }
}

export type PriceByItemRefs = {[key: string]: (SubscriptionItemPrice & {description?: string, service?: string, _id?: string})};