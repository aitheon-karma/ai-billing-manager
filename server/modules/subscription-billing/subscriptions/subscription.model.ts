import db from '@aitheon/core-server/dist/config/db';
import { GetSubscriptionSchema } from '../../../shared_models/models/subscription.model';
export const SubscriptionSchema = GetSubscriptionSchema(db.connection);
export {
  SUBSCRIPTION_ENTITIES,
  Subscription,
  ISubscription,
  SubscriptionItem,
  SUBSCRIPTION_ITEM_TYPE,
  SUBSCRIPTION_STATUS,
  SUBSCRIPTION_BILLING_INTERVAL,
  SubSubscriptionItem
} from '../../../shared_models/models/subscription.model';