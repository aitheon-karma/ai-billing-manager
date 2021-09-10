import Db from '@aitheon/core-server/dist/config/db';
import { GetSubscriptionOperationsSchema } from '../../shared_models/models/subscription-operations.model';
export const SubscriptionOperationsSchema = GetSubscriptionOperationsSchema(Db.connection);
