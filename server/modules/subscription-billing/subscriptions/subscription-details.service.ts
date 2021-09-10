import { Service, Inject } from 'typedi';
import { SubscriptionSchema, SUBSCRIPTION_ENTITIES, Subscription, ISubscription, SUBSCRIPTION_ITEM_TYPE, SubscriptionItem, SUBSCRIPTION_STATUS, SUBSCRIPTION_BILLING_INTERVAL } from './subscription.model';
import { ServicesService, SERVICE_IGNORE_LIST } from '../../shared/services/services.service';
import { Service as ServiceClass } from '../../shared/services/service.model';
import { OrganizationSchema } from '../../shared/organizations/organization.model';
import { UserSchema } from '../../shared/users/user.model';
import * as _ from 'lodash';
import db from '@aitheon/core-server/dist/config/db';
import { ObjectID } from 'mongodb';
import { SubscriptionPriceService } from '../subscription-prices/subscription-price.service';
import { SubscriptionItemPriceStrategyQuantity } from '../subscription-prices/subscription-price.model';
import { JSONSchema } from 'class-validator-jsonschema';
import { IsString, IsBoolean, IsNumberString, Equals, Min, Max, IsMongoId, ValidateNested, IsOptional, IsDateString, IsEnum, IsNumber, } from 'class-validator';
import { Type, Expose } from 'class-transformer';
import { deriveClass } from '../../shared/helpers';
import { ErrorBadInput } from '../../core/errors';

@JSONSchema({ description: 'SubscriptionDetailError' })
class SubscriptionDetailError {

  @IsOptional()
  @IsString()
  error: string;

  @IsOptional()
  @IsString()
  service: string;

}

@JSONSchema({ description: 'SubscriptionDetailServiceBillingAllocationPrice' })
export class SubscriptionDetailServiceBillingAllocationPrice {
  @IsOptional()
  @IsNumber()
  calculatedPrice: number;

  @IsOptional()
  @IsString()
  currency: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => Number)
  ranges?: Array<number>;

  @IsOptional()
  prices?: Array<Array<number>>;
}

class SubscriptionDetailAllocation {

  @Expose()
  @IsOptional()
  @IsString()
  service: string;

  @Expose()
  @IsOptional()
  @Type(() => SubscriptionDetailServiceBillingAllocationPrice)
  itemPrice?: SubscriptionDetailServiceBillingAllocationPrice;

  @Expose()
  @IsNumber()
  @IsOptional()
  used?: number;

  @IsOptional()
  @IsString()
  name: string;

  @Expose()
  @IsNumber()
  @IsOptional()
  available?: number;

  @Expose()
  @IsNumber()
  @IsOptional()
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
}

@JSONSchema({ description: 'SubscriptionBillingDetails' })
export class SubscriptionBillingDetails {
  @IsOptional()
  @IsString()
  service: string;

  @IsOptional()
  @IsEnum(SUBSCRIPTION_STATUS)
  status: SUBSCRIPTION_STATUS;

  @IsOptional()
  @IsEnum(SUBSCRIPTION_ENTITIES)
  entity?: SUBSCRIPTION_ENTITIES;

  @IsOptional()
  @IsString()
  entityReference?: string;

  @IsOptional()
  allocations: Array<SubscriptionDetailAllocation>;

  @IsOptional()
  subscriptionEntry?: boolean;

  @IsOptional()
  @IsString()
  error?: string;
}

@JSONSchema({ description: 'SubscriptionDetailsForService' })
export class SubscriptionDetailsForService {
  @IsOptional()
  @IsString()
  service: string;

  @IsOptional()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description: string;

  @IsOptional()
  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  @IsBoolean()
  core: boolean;

  @IsOptional()
  @IsString()
  url: string;

  @IsOptional()
  billing: SubscriptionBillingDetails | SubscriptionDetailError;
}

@JSONSchema({ description: 'SubscriptionDetails' })
export class SubscriptionDetails {
  @IsOptional()
  @IsString()
  organization: string;

  @IsOptional()
  services: {[key: string]: SubscriptionDetailsForService};

  @IsOptional()
  @IsNumberString()
  monthlyPriceMultiplier: string;
}

@Service()
export class SubscriptionDetailsService {

  @Inject()
  servicesService: ServicesService;

  @Inject()
  subsciptionPriceService: SubscriptionPriceService;

  getUsage: {[key in SUBSCRIPTION_ITEM_TYPE]?: (...args: any[]) => Promise<number>} = {
    [SUBSCRIPTION_ITEM_TYPE.USER]: this.userUsageCount,
    [SUBSCRIPTION_ITEM_TYPE.INFRASTRUCTURE]: this.infrastructureUsageCount,
    [SUBSCRIPTION_ITEM_TYPE.DEVICE]: this.devicesUsageCount,
  };

  async organizationServiceInfo(organizationId: string, service?: string): Promise<{[key: string]: SubscriptionDetailsForService}> {
    const result: {[key: string]: SubscriptionDetailsForService} = {};
    let organization = await OrganizationSchema.findById(organizationId);
    if (!organization) {
      throw new ErrorBadInput('Organization not found');
    }
    organization = organization.toObject();

    let services = this.servicesService.organizationServices;
    services = services.filter(s => !SERVICE_IGNORE_LIST.includes(s._id) && (!!service ? s._id === service : true));

    this.fillServiceDetailsMut(result, services, organization);

    const subscriptions: Subscription[] = await this.getOrganizationSubscriptions(organizationId, service);

    const filledSubscriptions: Array<SubscriptionBillingDetails | SubscriptionDetailError> = await this.fillSubscriptionPrices(services, subscriptions, SUBSCRIPTION_ENTITIES.ORGANIZATION, organizationId);
    const filledSubscriptionsWithUsage = await this.fillAllocationsUsage(organizationId, filledSubscriptions);

    filledSubscriptionsWithUsage.forEach((fs) => {
      result[fs.service].billing = fs;
    });
    return result;
  }

  async fillAllocationsUsage(organizationId: string, filledSubscriptions: Array<SubscriptionBillingDetails | SubscriptionDetailError>)
  : Promise<Array<SubscriptionBillingDetails | SubscriptionDetailError>> {
    return await Promise.all(
      filledSubscriptions
        .map(async (s) => {
          if (
            s instanceof SubscriptionBillingDetails
            && s.allocations
            && s.allocations.length > 0
          ) {
            for (let i = 0, l = s.allocations.length; i < l; i++) {
              const al = s.allocations[i];
              if (typeof this.getUsage[al.itemType as SUBSCRIPTION_ITEM_TYPE] === 'function') {
                al.used = await this.getUsage[al.itemType as SUBSCRIPTION_ITEM_TYPE](organizationId, s.service, al.itemReference);
                if (
                  al
                  && al.quantity
                  && typeof al.quantity === 'number'
                  && Number.isFinite(al.quantity)
                  && al.used
                  && typeof al.used === 'number'
                  && Number.isFinite(al.used)
                  && typeof al.available === 'undefined'
                ) {
                  al.available = al.quantity - al.used;
                }
              }
            }
          }
        return s as any;
        })
        .map(p => p.catch(console.error))
    );
  }

  fillServiceDetailsMut(result: {[key: string]: SubscriptionDetailsForService}, services: ServiceClass[], organization: any): void {
    for (const service of services) {
      const serviceInfo: SubscriptionDetailsForService = new SubscriptionDetailsForService;
      serviceInfo.service = service._id;
      serviceInfo.name = service.name;
      serviceInfo.url = service.url;
      serviceInfo.description = service.description;
      serviceInfo.enabled = organization.services.includes(service._id);
      serviceInfo.core = service.core;
      result[serviceInfo.service] = serviceInfo;
    }
  }


  async getOrganizationSubscriptions(organizationId: string, serviceId?: string): Promise<Subscription[]> {
    const query: any = {
      entity: SUBSCRIPTION_ENTITIES.ORGANIZATION,
      entityReference: organizationId
    };
    if (serviceId) {
      query.service = serviceId;
    }
    return (await SubscriptionSchema
      .find(query)
      .select('_id service type reference status allocations.itemReference allocations.itemType allocations.quantity allocations.service allocations.billingInterval')
    ).map(s => s.toObject());
  }

  async fillSubscriptionPrices(services: ServiceClass[], subscriptions: Subscription[], type: SUBSCRIPTION_ENTITIES, organizationId: string): Promise<Array<SubscriptionBillingDetails | SubscriptionDetailError>> {
    const promises = [];
    for (let i = 0, l = services.length; i < l; i++) {
      const service: ServiceClass = services[i];
      const subscription = subscriptions.find(sub => sub.service === service._id);
      let servicesWithSub = [service._id];
      if (subscription) {
        servicesWithSub = servicesWithSub.concat(subscription.allocations.reduce((a, al) => {
          if (al.service) {
            a.push(al.service);
          }
          return a;
        }, []));
      }
      promises.push(this.subsciptionPriceService.getActivePrice(servicesWithSub, type, organizationId, true)
        .then(({priceByItemRefs, modifiers}) => {
          const sub = new SubscriptionBillingDetails;
          sub.entity = type;
          sub.entityReference = organizationId;
          sub.service = service._id;
          if (!subscription) {
            sub.allocations = [];
            sub.subscriptionEntry = false;
          } else {
            sub.allocations = subscription.allocations.map(a => {
              const inst = deriveClass(SubscriptionDetailAllocation, a);
              return inst;
            });
            sub.subscriptionEntry = true;
          }
          return {priceByItemRefs, sub};
        })
        .then(async ({priceByItemRefs, sub}) => {
          if (typeof priceByItemRefs !== 'undefined' && priceByItemRefs !== null) {
            for (const refType in priceByItemRefs) {
              const price = priceByItemRefs[refType];
                if (price.service === service._id || (price.usableBy && price.usableBy.includes(service._id))) {
                  const detailAllocPrice = new SubscriptionDetailServiceBillingAllocationPrice;
                  detailAllocPrice.currency = price.currency;
                  if (price.billingInterval && price.itemType) {
                    const alloc = sub.allocations.find((a: SubscriptionDetailAllocation) => a.billingInterval === price.billingInterval && a.itemType === price.itemType);
                    if (typeof alloc !== 'undefined' && alloc !== null) {
                      if (alloc.service) {
                        const suballoc = await this.getSubAllocation(price.service, type, organizationId, price.itemType, price.itemReference, price.billingInterval, service._id);
                        alloc.quantity = suballoc.quantity;
                        alloc.available = (suballoc as any).available;
                      }
                      if (price.itemPrice.getPrice) {
                        detailAllocPrice.calculatedPrice = price.itemPrice.getPrice(alloc.quantity) * alloc.quantity;
                        if (price.itemPrice instanceof SubscriptionItemPriceStrategyQuantity) {
                          detailAllocPrice.ranges = (price.itemPrice as any).ranges;
                          detailAllocPrice.prices = (price.itemPrice as any).prices;
                        }
                      }

                      alloc.itemPrice = detailAllocPrice;
                    } else {
                      const zeroAlloc: SubscriptionDetailAllocation = new SubscriptionDetailAllocation;
                      zeroAlloc.itemType = price.itemType;
                      zeroAlloc.itemReference = price.itemReference;
                      zeroAlloc.billingInterval = price.billingInterval;
                      zeroAlloc.quantity = 0;
                      zeroAlloc.itemPrice = new SubscriptionDetailServiceBillingAllocationPrice;
                      zeroAlloc.itemPrice.calculatedPrice = price.itemPrice.getPrice(zeroAlloc.quantity) * zeroAlloc.quantity;
                      zeroAlloc.itemPrice.currency = price.currency;
                      if (price.itemPrice instanceof SubscriptionItemPriceStrategyQuantity) {
                        zeroAlloc.itemPrice.ranges = (price.itemPrice as any).ranges;
                        zeroAlloc.itemPrice.prices = (price.itemPrice as any).prices;
                      }
                      sub.allocations.push(zeroAlloc);
                    }
                  }
                }
            }
          }
          return sub;
        })
        .catch(err => {const e = new SubscriptionDetailError(); e.error = err.message; e.service = service._id; return e; }));

    }
    return await Promise.all(promises);
  }

  async userUsageCount(organizationId: string, serviceId: string, userId?: string) {
    let count = 0 ;
    const organizationMembers = await UserSchema
      .find({
        roles: {$elemMatch: {$and: [{'organization': organizationId}, {'services.service': serviceId}]}}
      })
      .countDocuments();
    const organizationServiceInvites = await db.connection.collection('organizationinvites')
      .find({
        organization: organizationId,
        'inviteAccess.service': serviceId
      })
      .count();

    if (typeof organizationServiceInvites === 'number' && Number.isFinite(organizationServiceInvites)) {
      count += organizationServiceInvites;
    }
    if (typeof organizationMembers === 'number' && Number.isFinite(organizationMembers)) {
      count += organizationMembers;
    }
    return count;
  }

  async infrastructureUsageCount(organizationId: string, userId?: string) {
    const query: {[key: string]: any} = {};
    if (organizationId) {
      query.organization = new ObjectID(organizationId);
    } else {
      query.user = new ObjectID(userId);
    }
    const count = await db.connection.collection('smart_infrastructure__infrastructures').countDocuments(query);
    return count;
  }

  async devicesUsageCount(organizationId: string, userId: string, deviceTypeId: string)  {
    const query: {[key: string]: any} = {};
    query.type = new ObjectID(deviceTypeId);
    if (organizationId) {
      query.organization = new ObjectID(organizationId);
    } else {
      query.user = new ObjectID(userId);
    }
    const count = await db.connection.collection('device_manager__devices').countDocuments(query);
    return count;
  }


  async getSubAllocation(
    service: string,
    entityType: SUBSCRIPTION_ENTITIES,
    entityReference: string,
    itemType: SUBSCRIPTION_ITEM_TYPE,
    itemReference: string,
    billingInterval: number,
    requestingService: string
  ) {
    const sub = await SubscriptionSchema.findOne({service, entity: entityType, entityReference});
    if (sub) {
      const alloc = sub.allocations.find(a => a.itemReference === itemReference.toString() && a.itemType === itemType && a.billingInterval === billingInterval);
      if (alloc) {
        const suballoc = alloc.subAllocations.find(sa => sa.service === requestingService);
        (suballoc as any).available = alloc.quantity - alloc.subAllocations.reduce((a, s) => {
          if (s.quantity) {
            a += s.quantity;
          }
          return a;
        }, 0);
        return suballoc;
      }
    }
  }


}
