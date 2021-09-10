import db from '@aitheon/core-server/dist/config/db';
import { GetPaymentHistorySchema } from '../../shared_models/models/payment-history.model';
export const PaymentHistorySchema = GetPaymentHistorySchema(db.connection);
export { PaymentHistory, PaymentCharges, PAYMENT_HISTORY_CREATED_BY_KIND, PaymentHistoryCreatedBy } from '../../shared_models/models/payment-history.model';