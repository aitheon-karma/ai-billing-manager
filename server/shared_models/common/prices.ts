import {
  SubscriptionItemPrice,
  SubscriptionItemPriceModifier,
  SUBSCRIPTION_ENTITIES,
  Subscription,
  SubscriptionItemPriceStrategyQuantity,
  SUBSCRIPTION_ITEM_PRICING_STRATEGY,
  ISubscriptionPriceModifier,
  SubscriptionItem,
  SubscriptionPriceModifier,
} from '../index';
import { deriveClass, validateInstance, toRoundedNumber, deriveClassFromExisting } from '../shared/helpers';
import {
  Models,
  ApplicablePrice,
  PriceByItemRefs,
} from './shared-structures';

export async function getApplicablePrices(service: string, entity: SUBSCRIPTION_ENTITIES, entityReference: string, models: Models)
  : Promise<ApplicablePrice[]> {
  const startDate = new Date();
  const aggregations = [
    {
      $match: {
        $or: [
          { service },
          { 'items.usableBy': { $all: [service] } }
        ],
        startDate: { $lte: startDate },
      }
    },
    {
      $sort: { startDate: -1 }
    },
    {
      $group: {
        '_id': '$service',
        'priceId': { '$first': '$_id' },
        'items': { '$first': '$items' },
        'service': { '$first': '$service' },
        'startDate': { '$first': '$startDate' },
      }
    }
  ];
  let prices: Array<ApplicablePrice> = await models.SubscriptionPriceModel.aggregate(aggregations);
  prices = prices.map(p => {
    p.priceId = p.priceId.toString();
    p.items = p.items.map(pi => {
      pi.itemReference = pi.itemReference.toString();
      pi._id && (pi._id = pi._id.toString());
      return pi;
    });
    return deriveClass(ApplicablePrice, p);
  });
  return prices;
}

export async function preparePrices(prices: ApplicablePrice[], service: string)
  : Promise<PriceByItemRefs> {
  const pricesByItems = await pricesByRefs(prices, service);
  if (!pricesByItems) {
    throw new Error('Error retreiving price');
  }
  return pricesByItems;
}

export async function prepareModifiers(modifiers: SubscriptionPriceModifier[])
  : Promise<{ [key: string]: SubscriptionItemPriceModifier & { description?: string } }> {
  let temp: { specific: { [key: string]: SubscriptionItemPriceModifier }, general: { [key: string]: SubscriptionItemPriceModifier }, specificmods: boolean } = { specific: {}, general: {}, specificmods: false };
  if (modifiers && Array.isArray(modifiers) && modifiers.length > 0) {
    temp = modifiers.reduce((a: { specific: { [key: string]: SubscriptionItemPrice }, general: { [key: string]: SubscriptionItemPrice }, specificmods: boolean }, m: SubscriptionPriceModifier) => {
      let target: { [key: string]: SubscriptionItemPriceModifier };
      if (m.entity && m.entityReference) {
        target = a.specific;
      } else {
        target = a.general;
      }
      if (target) {
        m.items.forEach((p: SubscriptionItemPriceModifier) => {
          (p as any).description = m.description;
          const key = p.billingInterval + '|' + p.itemReference + '|' + p.itemType;
          !target[key] && (target[key] = p);
        });
      }
      return a;
    }, temp);
  }
  const modifiersByItems: { [key: string]: (SubscriptionItemPriceModifier & { description?: string }) } = temp.specific;
  for (const key in temp.general) {
    if (!modifiersByItems[key]) {
      modifiersByItems[key] = temp.general[key];
    }
  }
  return modifiersByItems;
}

export async function pricesByRefs(prices: ApplicablePrice[], service: string)
  : Promise<PriceByItemRefs> {
  const priceByItemRefs: PriceByItemRefs = prices.reduce((a: PriceByItemRefs, p) => {
    p.items.forEach(i => {
      if ((p.service === service || (i.usableBy && i.usableBy.includes(service)))) {
        const key = i.billingInterval + '|' + i.itemReference + '|' + i.itemType;
        if (a[key]) {
          throw new Error('Duplicate prices entires derived');
        }
        a[key] = i;
        a[key].service = p.service;
        a[key]._id = p.priceId;
      }
    });
    return a;
  }, {});
  return priceByItemRefs;
}

export async function getApplicableModifers(
  service: string,
  entity: SUBSCRIPTION_ENTITIES,
  entityReference: string,
  allocations: SubscriptionItem[],
  models: Models,
  date: Date = new Date(),
): Promise<SubscriptionPriceModifier[]> {
  const services = [service];
  if (allocations && allocations.length > 0) {
    allocations.forEach(a => a.service && services.push(a.service));
  }
  const query: any = {
    service: { $in: services },
    $and: [
      { startDate: { $lte: date } },
      {
        $or: [
          // tslint:disable-next-line:no-null-keyword
          { endDate: { $in: [null] } },
          { endDate: { $exists: false } },
          { endDate: { $gt: date } }
        ]
      }
    ],
    $or: [
      {
        $and: [
          { entity: { $exists: false } },
          { entityReference: { $exists: false } }
        ]
      },
      {
        $and: [
          { entity },
          { entityReference },
        ]
      }
    ]
  };
  let modifiers: ISubscriptionPriceModifier[] = await models.SubscriptionPriceModifierModel.find(query);
  modifiers = modifiers.map(m => deriveClass(SubscriptionPriceModifier, m.toObject()));
  return modifiers;
}

export function applyPricesAndModifiers(subscription: Subscription, prices: PriceByItemRefs, modifiers: { [key: string]: SubscriptionItemPriceModifier & { description?: string } }) {
  const applied = applyModifiersMut(prices, modifiers);
  const resolved = resolvePriceStrategiesMut(applied);
  return resolved;
}

export function applyModifiersMut(price: PriceByItemRefs, modifiers: { [key: string]: SubscriptionItemPriceModifier & { description?: string } }): PriceByItemRefs {
  for (const key in price) {
    if (modifiers[key]) {
      price[key].itemPrice = modifiers[key].itemPrice;
      price[key].description = modifiers[key].description;
    }
  }
  return price;
}

export async function resolvePriceStrategiesMut(price: PriceByItemRefs): Promise<PriceByItemRefs> {
  for (const key in price) {
    if (price[key].itemPrice.type === SUBSCRIPTION_ITEM_PRICING_STRATEGY.QUANTITY) {
      price[key].itemPrice = deriveClass(SubscriptionItemPriceStrategyQuantity, price[key].itemPrice);
      await validateInstance(price[key].itemPrice);
    }
  }
  return price;
}