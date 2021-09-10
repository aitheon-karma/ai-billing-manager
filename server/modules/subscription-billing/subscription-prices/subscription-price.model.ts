import Db from '@aitheon/core-server/dist/config/db';
import { GetSubscriptionPriceSchema } from '../../../shared_models/models/subscription-price.model';
export const SubscriptionPriceSchema = GetSubscriptionPriceSchema(Db.connection);
export { SubscriptionPrice, ISubscriptionPrice, SubscriptionItemPriceStrategyQuantity, SUBSCRIPTION_ITEM_PRICING_STRATEGY, SubscriptionItemPrice, SUBSCRIPTION_ITEM_PRICE_RANGES } from '../../../shared_models/models/subscription-price.model';
