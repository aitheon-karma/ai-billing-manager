import {
  SUBSCRIPTION_ENTITIES,
  Subscription,
  SubscriptionItem,
  PAYMENT_HISTORY_CREATED_BY_KIND,
  PaymentHistoryCreatedBy,
  PaymentHistory,
  PaymentCharges,
} from '../index';
import { deriveClass, toRoundedNumber } from '../shared/helpers';
import { ObjectID } from 'mongodb';
import * as operations from './operations';
import * as prices from './prices';
import * as subscriptions from './subscriptions';
import {
  Models,
  SubscriptionProcessingContext,
  SubscriptionProcessingResolved,
  SubscriptionProcessingCalculated,
  CalculatedForAllocations,
  SubscriptionProcessingUpdateFormed,
  SubscriptionUpdatePayload
} from './shared-structures';
import * as moment from 'moment';

const dateFormat = 'MMM, DD YYYY';

export async function makeInitialProcessingSubscription(
  subscriptionId: string,
  service: string,
  entity: SUBSCRIPTION_ENTITIES,
  entityReference: string,
  allocations: SubscriptionItem[],
  models: Models,
  update?: { [key: string]: SubscriptionItem }
): Promise<SubscriptionProcessingContext> {
  const result: any = {
    service: service,
    entity: entity,
    entityReference: entityReference,
    update
  };
  if (allocations && allocations.length > 0) {
    result.allocations = allocations.reduce((a: any, alloc) => {
      a[`${alloc.billingInterval}|${alloc.itemReference}|${alloc.itemType}`] = alloc;
      return a;
    }, {});
  } else {
    result.allocations = {};
  }
  if (subscriptionId) {
    result.subscriptionId = subscriptionId;
  }
  if (allocations && entity && entityReference) {
    result.resolvedSuballocations = await subscriptions.resolveSuballocations(allocations, entity, entityReference, models);
  } else {
    result.resolvedSuballocations = {};
  }
  if (service && entity && entityReference) {
    result.prices = await prices.getApplicablePrices(service, entity, entityReference, models);
    result.modifiers = await prices.getApplicableModifers(service, entity, entityReference, allocations, models);
  }
  return deriveClass(SubscriptionProcessingContext, result);
}

export async function resolvePricesForProcessingSubscription(processingSubscription: SubscriptionProcessingContext)
  : Promise<SubscriptionProcessingContext> {
  const preparedPrices = await prices.preparePrices(processingSubscription.prices, processingSubscription.service);
  const preparedModifiers = await prices.prepareModifiers(processingSubscription.modifiers);
  const appliedModifiers = prices.applyModifiersMut(preparedPrices, preparedModifiers);
  const resolvedPriceStrategies = await prices.resolvePriceStrategiesMut(appliedModifiers);
  const processingSubscriptionPricesResolved = new SubscriptionProcessingResolved;
  processingSubscriptionPricesResolved.resolvedPrices = resolvedPriceStrategies;
  processingSubscription.changeState(processingSubscriptionPricesResolved);
  return processingSubscription;
}

export async function calculateAllocationsForProcessingSubscription(processingSubscription: SubscriptionProcessingContext, monthlyPriceMultiplier: number, checkAllocation?: (alloc: SubscriptionItem) => boolean)
  : Promise<SubscriptionProcessingContext> {
  const calculated: CalculatedForAllocations = calculateForSubscription(processingSubscription, monthlyPriceMultiplier, checkAllocation);

  const processingSubscriptionCalculated = new SubscriptionProcessingCalculated;
  processingSubscriptionCalculated.calculated = calculated;
  processingSubscriptionCalculated.resolvedPrices = processingSubscription.state.getResolvedPrices();
  processingSubscription.changeState(processingSubscriptionCalculated);
  return processingSubscription;
}

export async function calculateAllocationsForProcessingSubscriptionUpdate(processingSubscription: SubscriptionProcessingContext, update: SubscriptionUpdatePayload, monthlyPriceMultiplier: number, models: Models)
  : Promise<SubscriptionProcessingContext> {
  const calculated: CalculatedForAllocations = await calculateForUpdate(processingSubscription, update, monthlyPriceMultiplier, models);
  validateCalculatedUpdate(calculated, update);
  const processingSubscriptionCalculated = new SubscriptionProcessingCalculated;
  processingSubscriptionCalculated.calculated = calculated;
  processingSubscriptionCalculated.resolvedPrices = processingSubscription.state.getResolvedPrices();
  processingSubscription.changeState(processingSubscriptionCalculated);
  return processingSubscription;
}

export async function deriveUpdatesForProcessingSubscriptionUpdate(processingSubscription: SubscriptionProcessingContext, models: Models)
  : Promise<SubscriptionProcessingContext> {
  const updateOperations = await operations.formUpdateOperations(processingSubscription, models);
  const updatesDerived = new SubscriptionProcessingUpdateFormed;
  updatesDerived.updateOperations = updateOperations;
  updatesDerived.resolvedPrices = processingSubscription.state.getResolvedPrices();
  updatesDerived.calculated = processingSubscription.state.getCalculatedValues();
  processingSubscription.changeState(updatesDerived);
  return processingSubscription;
}

export async function calculateForUpdate(processingContext: SubscriptionProcessingContext, update: SubscriptionUpdatePayload, monthlyPriceMultiplier: number, models: Models) {
  const calculated = new CalculatedForAllocations;
  calculated.allocations = {};
  for (const upd of update.allocations) {
    const key = `${upd.billingInterval}|${upd.itemReference}|${upd.itemType}`;
    const price = processingContext.state.getResolvedPrices()[key];
    if (!price) {
      throw new Error(`Could not derive price for item: ${key}`);
    }
    let totalQuantity = undefined;
    let calculateQuantity = undefined;
    let suballocationId = undefined;
    if (price.service !== processingContext.service) {
      const originAllocationSubscription = await models.SubscriptionModel.findOne({
        entity: processingContext.entity,
        entityReference: processingContext.entityReference,
        service: price.service
      });
      if (originAllocationSubscription) {
        const originAllocation = originAllocationSubscription.allocations.find(originallocation => originallocation.billingInterval === upd.billingInterval && originallocation.itemType === upd.itemType && originallocation.itemReference === upd.itemReference);
        if (originAllocation) {
          const suballocation = originAllocation.subAllocations.find(suballocation => suballocation.service === processingContext.service);
          suballocationId = suballocation && suballocation._id;
          const available = originAllocation.quantity - originAllocation.subAllocations.reduce((a, sa) => {
            if (typeof sa.quantity === 'number' && Number.isFinite(sa.quantity) === true) {
              a += sa.quantity;
            }
            return a;
          }, 0);
          calculateQuantity = upd.changedQuantity - available;
          totalQuantity = originAllocation.quantity + upd.changedQuantity;
        } else {
          totalQuantity = upd.changedQuantity;
          calculateQuantity = upd.changedQuantity;
        }
      } else {
        totalQuantity = upd.changedQuantity;
        calculateQuantity = upd.changedQuantity;
      }
      if (!suballocationId) {
        suballocationId = new ObjectID().toHexString();
      }
    } else {
      const allocation = Object.values(processingContext.allocations).find(allocation => allocation.billingInterval === upd.billingInterval && allocation.itemReference === upd.itemReference && allocation.itemType === upd.itemType);
      if (allocation) {
        totalQuantity = allocation.quantity + upd.changedQuantity;
        calculateQuantity = upd.changedQuantity;
      } else {
        totalQuantity = upd.changedQuantity;
        calculateQuantity = upd.changedQuantity;
      }
    }
    if (typeof calculateQuantity === 'undefined' || calculateQuantity === null || (typeof calculateQuantity === 'number' && !Number.isFinite(calculateQuantity))) {
      throw new Error('Was not able to derive quantity for calculation');
    }
    if (calculateQuantity <= 0) {
      calculateQuantity = 0;
    }
    if (typeof totalQuantity === 'undefined' || totalQuantity === null || (typeof totalQuantity === 'number' && !Number.isFinite(totalQuantity))) {
      throw new Error('Was not able to derive total quantity for calculation');
    }
    const calculatedOne = price.itemPrice.getPrice(totalQuantity);
    if (typeof calculatedOne !== 'number' || !Number.isFinite(calculatedOne)) {
      throw new Error(`Calculated price is not a number: ${JSON.stringify(price.itemPrice)}`);
    }
    const calculatedTotal = calculatedOne * calculateQuantity * monthlyPriceMultiplier;
    if (typeof calculatedTotal !== 'number' || Number.isFinite(calculatedTotal) !== true) {
      throw new Error(`Calculated amount is not a number: ${JSON.stringify(calculatedOne)}, ${JSON.stringify(calculateQuantity)}, ${JSON.stringify(monthlyPriceMultiplier)}`);
    }
    calculated.allocations[key] = {
      calculatedOne,
      calculatedTotal,
      calculatedQuantity: upd.changedQuantity,
      itemType: upd.itemType,
      itemReference: upd.itemReference,
      suballocationId,
      billingInterval: upd.billingInterval
    };
    if (calculated.allocations[key].billingInterval === 1) {
      calculated.allocations[key].period = [
        moment().format(dateFormat),
        moment().startOf('M').add(1, 'M').format(dateFormat),
      ];
    } else {
      calculated.allocations[key].period = [
        moment().format(dateFormat),
        moment().add(calculated.allocations[key].billingInterval, 'M').format(dateFormat),
      ];
    }
    if (typeof calculated.total === 'undefined') {
      calculated.total = 0;
    }
    calculated.total += calculatedTotal;
  }
  if (typeof calculated.total === 'number' && Number.isFinite(calculated.total) === true) {
    calculated.total = toRoundedNumber(calculated.total);
  }
  return calculated;
}

export function validateCalculatedUpdate(calculated: CalculatedForAllocations, update: SubscriptionUpdatePayload) {
  if (calculated.total !== update.updateOneTimeTotalPrice) {
    throw new Error(`Incorrect total one time amount: calculated=${calculated.total}, incoming=${update.updateOneTimeTotalPrice}`);
  }
  return true;
}

export function calculateForSubscription(processingSubscription: SubscriptionProcessingContext, monthlyPriceMultiplier?: number, checkAllocation?: (alloc: SubscriptionItem) => boolean)
  : CalculatedForAllocations {
  const calculated = new CalculatedForAllocations;
  calculated.allocations = {};

  for (const allocId in processingSubscription.allocations) {
    const alloc = processingSubscription.allocations[allocId];
    if (checkAllocation && checkAllocation(alloc) !== true) {
      break;
    }
    const key = `${alloc.billingInterval}|${alloc.itemReference.toString()}|${alloc.itemType}`;
    const price = processingSubscription.state.getResolvedPrices()[key];
    if (!price) {
      throw new Error(`Could not derive price for item: ${key}`);
    }
    let quantity = undefined;
    if (alloc.subAllocations && alloc.subAllocations.length > 0) {
      quantity = alloc.quantity - alloc.subAllocations.reduce((a, s) => {a += s.quantity; return a; }, 0);
    } else {
      quantity = alloc.quantity;
    }
    let suballocationId = undefined;
    if (typeof quantity !== 'number' && alloc.service) {
      const suballoc = processingSubscription.resolvedSuballocations
        && processingSubscription.resolvedSuballocations[alloc._id];
      if (!suballoc) {
        throw new Error('Was not able to derive origin allocation');
      }
      const suballocation =  suballoc.subAllocations.find(sa => sa.service === processingSubscription.service);
      if (!suballocation) {
        throw new Error('Was not able to derive suballocation');
      }
      quantity = suballocation.quantity;
      if (typeof quantity !== 'number' || Number.isFinite(quantity) !== true) {
        throw new Error('Was not able to derive total quantity for suballocation');
      }
      suballocationId = suballoc._id;
    }

    const calculatedPrice = price.itemPrice.getPrice(quantity);
    if (typeof calculatedPrice !== 'number' || Number.isFinite(calculatedPrice) !== true) {
      throw new Error(`Calculated price is not a number: ${JSON.stringify(price.itemPrice)}`);
    }
    const calculatedPriceRounded = toRoundedNumber(calculatedPrice);
    let calculatedTotal = calculatedPriceRounded * quantity;
    if (monthlyPriceMultiplier) {
      calculatedTotal *= monthlyPriceMultiplier;
    }
    if (typeof calculatedTotal !== 'number' || Number.isFinite(calculatedTotal) !== true) {
      throw new Error(`Calculated amount is not a number: ${JSON.stringify(calculatedPrice)}, ${JSON.stringify(calculatedTotal)}, ${JSON.stringify(monthlyPriceMultiplier)}`);
    }
    calculatedTotal = toRoundedNumber(calculatedTotal);

    calculated.allocations[key] = {
      calculatedOne: calculatedPrice,
      calculatedTotal: calculatedTotal,
      calculatedQuantity: quantity,
      itemType: alloc.itemType,
      itemReference: alloc.itemReference,
      billingInterval: alloc.billingInterval
    };
    if (calculated.allocations[key].billingInterval === 1) {
      calculated.allocations[key].period = [
        moment().startOf('M').format(dateFormat),
        moment().startOf('M').add(1, 'M').format(dateFormat),
      ];
    } else {
      calculated.allocations[key].period = [
        moment().format(dateFormat),
        moment().add(calculated.allocations[key].billingInterval, 'M').format(dateFormat),
      ];
    }
    if (typeof suballocationId !== 'undefined') {
      calculated.allocations[key].suballocationId = suballocationId;
    }
    if (typeof calculated.total === 'undefined' || calculated.total === null) {
      calculated.total = 0;
    }
    calculated.total += calculatedTotal;
  }
  if (typeof calculated.total === 'number' && Number.isFinite(calculated.total) === true) {
    calculated.total = toRoundedNumber(calculated.total);
  }
  return calculated;
}

export async function getSuballocQuantity(subscription: Subscription, allocation: SubscriptionItem, models: Models) {
  const suballocSubscription = await models.SubscriptionModel.findOne({ service: allocation.service, entity: subscription.entity, entityReference: subscription.entityReference });
  let suballoc = undefined;
  if (!suballocSubscription) {
    throw new Error('Could not find suballocation origin subscription');
  }
  for (let i = 0, l = suballocSubscription.allocations.length; i < l; i++) {
    const sa = suballocSubscription.allocations[i];
    if (
      sa.billingInterval === allocation.billingInterval
      && sa.itemReference === allocation.itemReference
      && sa.itemType === allocation.itemType
    ) {
      suballoc = sa;
    }
  }
  if (!suballoc) {
    throw new Error('Could not derive suballocation');
  }
  return suballoc.quantity;
}

export async function makePaymentHistory(calculatedSubscriptions: SubscriptionProcessingContext[], operationsId: string, isWorker: boolean, userId?: string) {
  let ph = new PaymentHistory;

  (ph as any).priceId = new Set;
  ph.entity = calculatedSubscriptions[0].entity;
  ph.entityReference = calculatedSubscriptions[0].entityReference;
  const createdBy = new PaymentHistoryCreatedBy;
  if (isWorker === true) {
    createdBy.kind = PAYMENT_HISTORY_CREATED_BY_KIND.WORKER;
  } else {
    createdBy.kind = PAYMENT_HISTORY_CREATED_BY_KIND.USER;
    createdBy.userId = userId;
  }
  ph.createdBy = createdBy;
  ph.operationsId = operationsId;
  ph = calculatedSubscriptions.reduce((a, ab) => {
    for (const itemKey in ab.state.getResolvedPrices()) {
      (a as any).priceId.add(ab.state.getResolvedPrices()[itemKey]._id);
      if (!a.currency) {
        a.currency = ab.state.getResolvedPrices()[itemKey].currency;
      }
    }
    if (!a.charges) {
      a.charges = [];
    }
    a.charges = a.charges.concat(Object.entries(ab.state.getCalculatedValues().allocations).map(([itemKey, alloc]) => {
      const ch = new PaymentCharges;
      ch.itemPrice = ab.state.getCalculatedValues().allocations[itemKey].calculatedOne;
      ch.finalPrice = ab.state.getCalculatedValues().allocations[itemKey].calculatedTotal;
      ch.itemReference = alloc.itemReference;
      ch.itemType = alloc.itemType;
      const quantity = alloc.calculatedQuantity;
      ch.quantity = quantity;
      ch.service = ab.service;
      ch.billingInterval = alloc.billingInterval;
      ch.period = alloc.period;
      if (alloc.suballocationId) {
        ch.suballocationId = ab.state.getCalculatedValues().allocations[itemKey].suballocationId;
      }
      return ch;
    }));
    if (typeof a.totalBillAmount === 'undefined') {
      a.totalBillAmount = 0;
    }
    if (typeof ab.state.getCalculatedValues().total !== 'number' || Number.isFinite(ab.state.getCalculatedValues().total) !== true) {
      return ph;
    }
    ph.totalBillAmount += ab.state.getCalculatedValues().total;
    return a;
  }, ph);
  ph.priceId = Array.from(ph.priceId);
  return ph;
}