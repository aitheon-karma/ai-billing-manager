
import { Service, Inject } from 'typedi';
import { PaymentHistory, PaymentHistorySchema } from './payment-history.model';
import { SUBSCRIPTION_ENTITIES } from '../subscription-billing/subscriptions/subscription.model';
import '../shared/fiat-transaction.model';

@Service()
export class PaymentHistoryService {

  constructor() {}

  async insertPayment(payment: PaymentHistory) {
    return await PaymentHistorySchema.insertMany(payment);
  }

  async getPaymentHistoryEntries(organizationId: string): Promise<PaymentHistory[]> {
    return await PaymentHistorySchema
      .find({
        entity: SUBSCRIPTION_ENTITIES.ORGANIZATION,
        entityReference: organizationId
      })
      .populate('transaction')
      .sort({createdAt: -1})
      .lean();
  }

}
