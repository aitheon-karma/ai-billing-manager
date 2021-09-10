import {
  SUBSCRIPTION_ENTITIES,
  Subscription,
  SubscriptionItem,
  SubSubscriptionItem,
  SUBSCRIPTION_ITEM_TYPE,
  ISubscription
} from '../index';
import { SUBSCRIPTION_STATUS } from '../models/subscription.model';
import { Models, ResolvedSuballocations } from './shared-structures';

export function createSubscription(id: string, entity: SUBSCRIPTION_ENTITIES, entityReference: string, service: string) {
  const subscription = new Subscription;
  subscription._id = id;
  subscription.entity = entity;
  subscription.entityReference = entityReference;
  subscription.service = service;
  subscription.status = SUBSCRIPTION_STATUS.ACTIVE;
  return subscription;
}

export function createAllocation(id: string, billingInterval: number, itemReference: string, itemType: SUBSCRIPTION_ITEM_TYPE, quantity: number, lastRenewDate: Date, service?: string) {
  const allocation = new SubscriptionItem;
  allocation._id = id;
  allocation.billingInterval = billingInterval;
  allocation.itemReference = itemReference;
  allocation.itemType = itemType;
  if (typeof quantity === 'number' && Number.isFinite(quantity)) {
    allocation.quantity = quantity;
  }
  if (service) {
    allocation.service = service;
  }
  allocation.subAllocations = [];
  allocation.lastRenewDate = lastRenewDate;
  return allocation;
}

export async function getSubscription(entity: SUBSCRIPTION_ENTITIES, entityReference: string, service: string, models: Models)
: Promise<Subscription | null> {
  const sub = await models.SubscriptionModel.findOne({entity, entityReference, service});
  if (sub) {
    return sub.toObject();
  }
  return sub;
}

export function createOriginAllocation(id: string, billingInterval: number, itemReference: string, itemType: SUBSCRIPTION_ITEM_TYPE, quantity: number, service: string) {

  const allocation = new SubscriptionItem;
  allocation._id = id;
  allocation.billingInterval = billingInterval;
  allocation.itemReference = itemReference;
  allocation.itemType = itemType;
  allocation.quantity = quantity;

  return allocation;
}

export function createSubAllocation(service: string, suballocationId: string, quantity: number) {
  const createdSuballocation = new SubSubscriptionItem;
  createdSuballocation._id = suballocationId;
  createdSuballocation.quantity = quantity;
  createdSuballocation.service = service;
  return createdSuballocation;
}

export async function resolveSuballocations(allocations: SubscriptionItem[], entity: SUBSCRIPTION_ENTITIES, entityReference: string, models: Models)
  : Promise<ResolvedSuballocations> {
  let result = new ResolvedSuballocations;
  if (allocations && allocations.length > 0) {
    result = await allocations.reduce(async (a, alloc) => {
      if (alloc.service) {
        const resolved = await a;
        const subSubscription: ISubscription = (await models.SubscriptionModel.findOne({
          service: alloc.service,
          entity: entity,
          entityReference: entityReference
        })).toObject();
        const suballoc = subSubscription.allocations.find((suba: SubscriptionItem) => {
          return suba.itemReference.toString() === alloc.itemReference.toString() && suba.itemType === alloc.itemType && suba.billingInterval === alloc.billingInterval;
        });
        if (!suballoc) {
          throw new Error(`Was not able to derive suballocation for allocation: ${alloc._id}`);
        }
        resolved[alloc._id.toString()] = suballoc;
        return resolved;
      } else {
        return a;
      }
    }, Promise.resolve(result));
  }
  return result;

}