import Db from '@aitheon/core-server/dist/config/db';
import { GetSubscriptionPriceModifierSchema } from '../../../shared_models/models/subscription-price-modifiers.model';
export const SubscriptionPriceModifierSchema = GetSubscriptionPriceModifierSchema(Db.connection);
export { SubscriptionPriceModifier, ISubscriptionPriceModifier, SubscriptionItemPriceModifier } from '../../../shared_models/models/subscription-price-modifiers.model';
