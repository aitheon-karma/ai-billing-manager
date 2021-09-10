
import { Service, Inject } from 'typedi';
import { SUBSCRIPTION_ENTITIES } from '../subscriptions/subscription.model';
import { SubscriptionPriceModifierSchema, SubscriptionPriceModifier, ISubscriptionPriceModifier, SubscriptionItemPriceModifier } from './subscription-price-modifiers.model';
import { SubscriptionItemPrice } from '../subscription-prices/subscription-price.model';

@Service()
export class SubscriptionPriceModifiersService {

  constructor() {}

  async findModifiers(service?: string, type?: SUBSCRIPTION_ENTITIES, reference?: string, date?: Date) {
    const query: any = {};
    if (service) {
      query.service = service;
    }
    if (type && reference) {
      query.type = type;
      query.reference = reference;
    }
    if (date) {
      query.$and = [
        {
          $or: [
            // tslint:disable-next-line:no-null-keyword
            {startDate: {$in: [null]}},
            {startDate: {$exists: false}},
            {startDate: {$lte: date}}
          ],
        },
        {
          $or: [
            // tslint:disable-next-line:no-null-keyword
            {endDate: {$in: [null]}},
            {endDate: {$exists: false}},
            {endDate: {$gt: date}}
          ]
        }
      ];
    }
    return await SubscriptionPriceModifierSchema.find(query);
  }

  async findApplicableModifers(
    services: string[],
    type: SUBSCRIPTION_ENTITIES,
    reference: string,
    date: Date = new Date()
  ): Promise<{[key: string]: SubscriptionItemPriceModifier & {description?: string}}> {
    const query: any = {
      service: {$in: services},
      $and: [
        {startDate: {$lte: date}},
        {
          $or: [
            // tslint:disable-next-line:no-null-keyword
            {endDate: {$in: [null]}},
            {endDate: {$exists: false}},
            {endDate: {$gt: date}}
          ]
        }
      ],
      $or: [
        {
          $and: [
            {entity: {$exists: false}},
            {entityReference: {$exists: false}}
          ]
        },
        {
          $and: [
            {entity: type},
            {entityReference: reference},
          ]
        }
      ]
    };
    const modifiers = await SubscriptionPriceModifierSchema.find(query);
    let temp: {specific: {[key: string]: SubscriptionItemPriceModifier}, general: {[key: string]: SubscriptionItemPriceModifier}, specificmods: boolean} = {specific: {}, general: {}, specificmods: false};
    if (modifiers && Array.isArray(modifiers) && modifiers.length > 0) {
      temp = modifiers.reduce((a: {specific: {[key: string]: SubscriptionItemPrice}, general: {[key: string]: SubscriptionItemPrice}, specificmods: boolean}, m: ISubscriptionPriceModifier) => {
        let target: {[key: string]: SubscriptionItemPriceModifier};
        if (m.entity && m.entityReference) {
          target = a.specific;
        } else {
          target = a.general;
        }
        if (target) {
          m = m.toObject();
          m.items.forEach((p: SubscriptionItemPriceModifier) => {
            (p as any).description = m.description;
            const key = p.billingInterval + '|' + p.itemReference + '|' + p.itemType;
            !target[key] && (target[key] = p);
          });
        }
        return a;
      }, temp);
    }
    const result: {[key: string]: (SubscriptionItemPriceModifier & {description?: string})} = temp.specific;
    for (const key in temp.general) {
      if (!result[key]) {
        result[key] = temp.general[key];
      }
    }
    return result;
  }

  async createPriceModifier(priceModifier: SubscriptionPriceModifier): Promise<ISubscriptionPriceModifier> {
    const created = await SubscriptionPriceModifierSchema.create(priceModifier);
    return created.toObject();
  }

  async updatePriceModifier(priceModifierId: string, priceModifier: SubscriptionPriceModifier): Promise<SubscriptionPriceModifier> {
    const pm = await SubscriptionPriceModifierSchema.findById(priceModifierId);
    pm.overwrite(priceModifier);
    await pm.save();
    return pm;
  }

  async deletePriceModifier(priceModifierId: string): Promise<boolean> {
    const result = await SubscriptionPriceModifierSchema.deleteOne({_id: priceModifierId});
    return result.ok && result.deletedCount === 1;
  }

}
