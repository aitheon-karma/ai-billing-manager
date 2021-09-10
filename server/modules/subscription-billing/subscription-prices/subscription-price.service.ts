
import { Service, Inject } from 'typedi';
import { SubscriptionPrice, SubscriptionPriceSchema, ISubscriptionPrice, SubscriptionItemPriceStrategyQuantity, SUBSCRIPTION_ITEM_PRICING_STRATEGY, SubscriptionItemPrice } from '../subscription-prices/subscription-price.model';
import { SUBSCRIPTION_ENTITIES, SUBSCRIPTION_ITEM_TYPE } from '../subscriptions/subscription.model';
import { ErrorBadInput, ErrorUndefinedState, ErrorConflict } from '../../core/errors';
import { SubscriptionPriceModifiersService } from '../subscription-price-modifiers/subscription-price-modifiers.service';
import { SubscriptionPriceModifier, ISubscriptionPriceModifier, SubscriptionItemPriceModifier } from '../subscription-price-modifiers/subscription-price-modifiers.model';
import { ObjectID } from 'mongodb';
import { deriveClass, validateInstance } from '../../shared/helpers';

export type PriceByItemRefs = {[key: string]: (SubscriptionItemPrice & {description?: string, service?: string, _id?: string})};
export type AggregatedPrice = {_id: string, priceId: string, items: Array<SubscriptionItemPrice>, service: string, startDate: string};

@Service()
export class SubscriptionPriceService {

  @Inject()
  priceModifiersService: SubscriptionPriceModifiersService;

  constructor() {}

  async create(userId: string, price: SubscriptionPrice): Promise<ISubscriptionPrice> {
    if (!Array.isArray(price.items)) {
      throw new ErrorBadInput('Prices must be an array');
    }
    if (price.startDate) {
      const dt = new Date(price.startDate);
      // magic isNaN conversion
      // @ts-ignore
      if (Object.prototype.toString.call(dt) !== '[object Date]' || isNaN(dt)) {
        throw new ErrorBadInput('Invalid date');
      }
    }

    if (new Date(price.startDate).getTime() < Date.now()) {
      throw new ErrorBadInput('Start date must be a point in the future, got ' + price.startDate);
    }

    price.createdBy = userId;

    let newPrice;
    try {
      newPrice = SubscriptionPriceSchema.create(price);
    } catch (err) {
      throw new ErrorUndefinedState('Could not create new price: ' + err.message);
    }
    return newPrice;
  }

  async delete(priceId: string): Promise<boolean> {
    const price = await SubscriptionPriceSchema.findOne({_id: priceId});
    if (!price) {
      throw new ErrorBadInput('Could not find specified price');
    }
    const prices = await this.getPricesForDate(new Date(price.startDate), price.service);
    if (prices && Array.isArray(prices) && prices.length > 1) {
      const deleted = await SubscriptionPriceSchema.deleteOne({_id: priceId});
      return deleted.ok && deleted.deletedCount === 1;
    } else {
      throw new ErrorConflict('Can not delete price leaving zero prices for the period');
    }
  }

  async update(priceId: string, price: SubscriptionPrice): Promise<SubscriptionPrice> {
    const updatePrice = await SubscriptionPriceSchema.findOne({_id: priceId});
    if (!updatePrice) {
      throw new ErrorBadInput('Could not find specified price');
    }
    updatePrice.overwrite(price);
    await updatePrice.save();
    return updatePrice;
  }

  async list(service?: string) {
    const query: any = {};
    if (service) {
      query.service = service;
    }
    return SubscriptionPriceSchema.find(query);
  }

  async getPricesForDate(startDate: Date, service: string) {
    const query: any = {
      service,
      startDate: {$lte: startDate},
    };
    return await SubscriptionPriceSchema.find(query);
  }

  async findPrice(priceId: string, includeModifiers: boolean = false, entity: SUBSCRIPTION_ENTITIES, entityReference: string ) {
    const price = await SubscriptionPriceSchema.findOne({_id: priceId});
    if (!price) {
      throw new ErrorBadInput('Could not find specified price');
    }
    let modifiers: {[key: string]: (SubscriptionItemPriceModifier & {description?: string})};
    if (includeModifiers === true) {
      try {
        modifiers = await this.priceModifiersService.findApplicableModifers([price.service], entity, entityReference);
      } catch (err) {
        throw new ErrorBadInput('Error retreiving modifiers for specified price: ' + err.message);
      }
    }
    if (price) {
      return { price, modifiers };
    }
  }

  async getItemPrices(service: string, entityType?: SUBSCRIPTION_ENTITIES, entityReference?: string, itemType?: SUBSCRIPTION_ITEM_TYPE, itemReference?: string, includeModifiers?: boolean)
  : Promise<PriceByItemRefs> {
    const startDate = new Date();
    const aggregations = [
      {
        $match: {
          $or: [
            {service},
            // TODO verify working
            {'items.usableBy': {$all: [service]}}
          ],
          startDate: {$lte: startDate},
        }
      },
      {
        $sort: {startDate: -1}
      },
      {
        $group: {
          _id: '$service',
          priceId: {'$first': '$_id'},
          'items': { '$first': '$items' },
          'service' : { '$first': '$service' },
          'startDate' : { '$first': '$startDate' },
        }
      }
    ];
    const prices: Array<AggregatedPrice> = await SubscriptionPriceSchema.aggregate(aggregations);
    let pricesByItems = await this.pricesByItems(prices, itemType, itemReference, service);
    if (!pricesByItems) {
      throw new ErrorBadInput('Error retreiving price');
    }
    if (includeModifiers === true) {
      try {
        const modifiers = await this.priceModifiersService.findApplicableModifers([service], entityType, entityReference);
        pricesByItems = this.applyModifiersMut(pricesByItems, modifiers);
      } catch (err) {
        throw new ErrorBadInput('Error retreiving modifiers for active price: ' + err.message);
      }
    }
    pricesByItems = await this.resolvePriceStrategiesMut(pricesByItems);
    return pricesByItems;
  }

  async pricesByItems(prices: AggregatedPrice[], itemType: SUBSCRIPTION_ITEM_TYPE, itemReference: string, service?: string)
  : Promise<PriceByItemRefs> {
    const priceByItemRefs: PriceByItemRefs = prices.reduce((a: PriceByItemRefs, p) => {
      p.items.forEach(i => {
        if ((p.service === service || (i.usableBy && i.usableBy.includes(service))) && i.itemReference.toString() === itemReference && i.itemType === itemType) {
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

  async getServicePricesWithShared(service: string, entityType?: SUBSCRIPTION_ENTITIES, entityReference?: string, includeModifiers?: boolean)
  : Promise<PriceByItemRefs> {
    const startDate = new Date();
    const aggregations = [
      {
        $match: {
          $or: [
            {service},
            {'items.usableBy': {$all: [service]}}
          ],
          startDate: {$lte: startDate},
        }
      },
      {
        $sort: {startDate: -1}
      },
      {
        $group: {
          _id: '$service',
          priceId: {'$first': '$_id'},
          'items': { '$first': '$items' },
          'service' : { '$first': '$service' },
          'startDate' : { '$first': '$startDate' },
        }
      }
    ];

    const prices: ISubscriptionPrice[] = await SubscriptionPriceSchema.aggregate(aggregations);

    let priceByItemRefs: PriceByItemRefs = prices.reduce((a: PriceByItemRefs, p) => {
      p.items.forEach(i => {
        if (p.service === service || (i.usableBy && i.usableBy.includes(service))) {
          const key = i.billingInterval + '|' + i.itemReference + '|' + i.itemType;
          if (a[key]) {
            throw new Error('Duplicate prices entires derived');
          }
          a[key] = i;
          a[key].service = p.service;
          a[key]._id = p._id;
        }
      });
      return a;
    }, {});

    if (!priceByItemRefs) {
      throw new ErrorBadInput('Error retreiving price');
    }
    if (includeModifiers === true) {
      try {
        const modifiers = await this.priceModifiersService.findApplicableModifers([service], entityType, entityReference);
        priceByItemRefs = this.applyModifiersMut(priceByItemRefs, modifiers);
      } catch (err) {
        throw new ErrorBadInput('Error retreiving modifiers for active price: ' + err.message);
      }
    }
    priceByItemRefs = await this.resolvePriceStrategiesMut(priceByItemRefs);
    return priceByItemRefs;
  }

  async getActivePrice(services: string[], entityType?: SUBSCRIPTION_ENTITIES, entityReference?: string, includeModifiers?: boolean): Promise<{priceByItemRefs: PriceByItemRefs, modifiers: {[key: string]: SubscriptionItemPriceModifier & {description?: string}}}> {
    const startDate = new Date();
    const aggregations = [
      {
        $match: {
          $or: [
            {service: services[0]},
            {'items.usableBy': {$all: [services[0]]}}
          ],
          startDate: {$lte: startDate},
        }
      },
      {
        $sort: {startDate: -1}
      },
      {
        $group: {
          _id: '$service',
          priceId: {'$first': '$_id'},
          'items': { '$first': '$items' },
          'service' : { '$first': '$service' },
          'startDate' : { '$first': '$startDate' },
        }
      }
    ];

    const prices: SubscriptionPrice[] = await SubscriptionPriceSchema.aggregate(aggregations);


    let priceByItemRefs: PriceByItemRefs = prices.reduce((a: PriceByItemRefs, p) => {
      p.items.forEach(i => {
        if (p.service === services[0] || (i.usableBy && i.usableBy.includes(services[0]))) {
          const key = i.billingInterval + '|' + i.itemReference + '|' + i.itemType;
          if (a[key]) {
            throw new Error('Duplicate prices entires derived');
          }
          a[key] = i;
          a[key].service = p.service;
          a[key]._id = p._id;
        }
      });
      return a;
    }, {});

    if (!priceByItemRefs) {
      throw new ErrorBadInput('Error retreiving price');
    }
    let modifiers: {[key: string]: SubscriptionItemPriceModifier & {description?: string}};
    if (includeModifiers === true && prices && Array.isArray(prices) && prices.length > 0) {
      try {
        modifiers = await this.priceModifiersService.findApplicableModifers([services[0]], entityType, entityReference);
        priceByItemRefs = this.applyModifiersMut(priceByItemRefs, modifiers);
      } catch (err) {
        throw new ErrorBadInput('Error retreiving modifiers for active price: ' + err.message);
      }
    }
    priceByItemRefs = await this.resolvePriceStrategiesMut(priceByItemRefs);
    return {priceByItemRefs, modifiers};
  }

  applyModifiersMut(price: PriceByItemRefs, modifiers: {[key: string]: SubscriptionItemPriceModifier & {description?: string}}): PriceByItemRefs {
    for (const key in price) {
      if (modifiers[key]) {
        price[key].itemPrice = modifiers[key].itemPrice;
        price[key].description = modifiers[key].description;
      }
    }
    return price;
  }

  async resolvePriceStrategiesMut(price: PriceByItemRefs): Promise<PriceByItemRefs> {
    for (const key in price) {
      if ((price[key].itemPrice as any).type === SUBSCRIPTION_ITEM_PRICING_STRATEGY.QUANTITY) {
        price[key].itemPrice = deriveClass(SubscriptionItemPriceStrategyQuantity, price[key].itemPrice);
        await validateInstance(price[key].itemPrice);
      }
    }
    return price;
  }

  async getApplicablePrices(service: string, type?: SUBSCRIPTION_ENTITIES, reference?: string, includeModifiers?: boolean): Promise<{price: SubscriptionPrice, modifiers: {[key: string]: SubscriptionItemPriceModifier & {description?: string}}}> {
    const startDate = new Date();
    const query: any = {
      service,
      startDate: {$lte: startDate}
    };
    const prices = await SubscriptionPriceSchema.find(query).sort({startDate: -1});
    let modifiers: {[key: string]: SubscriptionItemPriceModifier & {description?: string}};
    if (includeModifiers === true) {
      try {
        modifiers = await this.priceModifiersService.findApplicableModifers([service], type, reference);
      } catch (err) {
        throw new ErrorBadInput('Error retreiving modifiers for active price: ' + err.message);
      }
    }
    if (prices && Array.isArray(prices) && prices.length > 0) {
      return {price: prices[0], modifiers };
    }
  }

}
