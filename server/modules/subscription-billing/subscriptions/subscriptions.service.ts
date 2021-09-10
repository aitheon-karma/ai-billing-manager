import { Service, Inject } from 'typedi';
import { ErrorBadInput, ErrorUndefinedState } from '../../core/errors';
import { Current, logger } from '@aitheon/core-server';
import * as _ from 'lodash';
import { SubscriptionSchema, SUBSCRIPTION_ENTITIES, Subscription, ISubscription, SubscriptionItem, SUBSCRIPTION_ITEM_TYPE, SUBSCRIPTION_STATUS, SUBSCRIPTION_BILLING_INTERVAL, SubSubscriptionItem } from './subscription.model';
import { SubscriptionDetailsService, SubscriptionDetails } from './subscription-details.service';
import { SubscriptionPriceService, PriceByItemRefs } from '../subscription-prices/subscription-price.service';
import { SubscriptionOperationsSchema } from '../../shared/subscription-operations.model';
import { JSONSchema } from 'class-validator-jsonschema';
import { IsString, IsArray, Min, Max, IsMongoId, ValidateNested, IsOptional, IsDateString, IsEnum, IsNumber, } from 'class-validator';
import { Type } from 'class-transformer';
import * as moment from 'moment';
import { ObjectID } from 'mongodb';
import { PaymentHistoryService } from '../../payment-history/payment-history.service';
import { TreasuryService } from '../../treasury/treasury.service';
import { Transaction } from '@aitheon/treasury-server';
import { PaymentHistorySchema } from '../../payment-history/payment-history.model';
import { Expose } from 'class-transformer';
import * as crypto from 'crypto';
import db from '@aitheon/core-server/dist/config/db';
import * as common from '../../../shared_models/common';
import { toRoundedNumber } from '../../../shared_models/index';
import * as invoice from '../../../shared_models/invoice';
import { SubscriptionPriceSchema } from '../subscription-prices/subscription-price.model';
import { SubscriptionPriceModifierSchema } from '../subscription-price-modifiers/subscription-price-modifiers.model';
import { environment } from '../../../environment';
import { RedisService } from '../../shared/redis.service';

const SERVICE_HTTP_COMMUNICATION_BASE_HOST = environment.production === true
  ? `https://${process.env.DOMAIN}/drive`
  : `http://localhost:${process.env.DRIVE_LOCAL_PORT}`;

const models = new common.Models;
models.SubscriptionModel = SubscriptionSchema;
models.SubscriptionPriceModel = SubscriptionPriceSchema;
models.SubscriptionPriceModifierModel = SubscriptionPriceModifierSchema;
models.PaymentHistoryModel = PaymentHistorySchema;
models.SubscriptionOperationsModel = SubscriptionOperationsSchema;

logger.taggedInfo = (opts: {tag: string}, ...args: any[]) => {
  logger.info.apply(logger, [opts.tag, ':'].concat(args));
};

@JSONSchema({ description: 'SubscriptionAddUsersPayload' })
export class SubscriptionAddUsersPayload {
  @Expose()
  @IsString()
  service: string;

  @Expose()
  @IsNumber()
  changedQuantity: number;

  @Expose()
  @IsEnum(SUBSCRIPTION_ITEM_TYPE)
  itemType: SUBSCRIPTION_ITEM_TYPE;

  @Expose()
  @IsMongoId()
  @IsString()
  itemReference: string;

  @Expose()
  @IsNumber()
  @Min(SUBSCRIPTION_BILLING_INTERVAL.MIN)
  @Max(SUBSCRIPTION_BILLING_INTERVAL.MAX)
  billingInterval: number;

  @Expose()
  @IsOptional()
  @IsString()
  suballocation?: string;

  @Expose()
  @IsNumber()
  updateOneTimeTotalPrice: number;
}

@JSONSchema({ description: 'SubscriptionUpdatePayload' })
export class SubscriptionAddUsers {
  @Expose()
  @IsArray()
  @Type(() => SubscriptionAddUsersPayload)
  services: SubscriptionAddUsersPayload[];

  @Expose()
  @IsNumber()
  amount: number;

  @Expose()
  @IsString()
  accountId: string;
}

const DEFAULT_PRECISION = 8;

@Service()
export class SubscriptionService {

  @Inject()
  subscriptionDetailsService: SubscriptionDetailsService;

  @Inject()
  subsciptionPriceService: SubscriptionPriceService;

  @Inject()
  paymentHistoryService: PaymentHistoryService;

  @Inject()
  treasuryService: TreasuryService;

  @Inject()
  redisService: RedisService;

  async subscriptionInfo(current: Current, service?: string) {
    if (current.organization) {
     return await this.organizationBillingInfo(current.organization._id, service);
    }
  }

  private async organizationBillingInfo(organizationId: string, service?: string) {
    const subscription: SubscriptionDetails = new SubscriptionDetails;
    subscription.organization = organizationId;
    subscription.services = await this.subscriptionDetailsService.organizationServiceInfo(organizationId, service);
    subscription.monthlyPriceMultiplier = this.getMonthlyPriceModifier().toFixed(DEFAULT_PRECISION);
    return subscription;
  }

  async createSubscription(userId: string, organizationId: string, subscription: Subscription) {
    if (!subscription) {
      throw new ErrorBadInput('Subscription object is required');
    }
    if (!subscription.entity) {
      throw new ErrorBadInput('Subscription type is required');
    }
    let reference;
    if (!subscription.entityReference) {
      switch (subscription.entity) {
        case SUBSCRIPTION_ENTITIES.ORGANIZATION: {
          reference = organizationId;
          break;
        }
        case SUBSCRIPTION_ENTITIES.USER: {
          reference = userId;
          break;
        }
      }
      if (!reference) {
        throw new ErrorBadInput('Could not derive entity reference: ' + subscription.entity);
      }
      subscription.entityReference = reference;
    }
    return await SubscriptionSchema.create(subscription);
  }

  async getSubscription(txId: string, userId: string, organizationId: string, serviceId: string, entityType: SUBSCRIPTION_ENTITIES, entityReference: string): Promise<ISubscription> {
    const subscriptions = await SubscriptionSchema.find({service: serviceId, entity: entityType, entityReference: new ObjectID(entityReference)});
    if (subscriptions.length > 1) {
      logger.taggedInfo({tag: txId}, 'Too much subscription entries');
      throw new Error('Too much subscription entries');
    }
    return subscriptions[0];
  }

  async updateSubscription(current: Current, userId: string, organizationId: string, serviceId: string, update: common.SubscriptionUpdatePayload) {
    const txId = `[${crypto.randomBytes(16).toString('hex')}]`;
    try {
      if (!update) {
        throw new ErrorBadInput('Allocation object is required');
      }
      if (!serviceId) {
        throw new ErrorBadInput('Service id is required');
      }
      logger.taggedInfo({tag: txId}, 'Update subscription started', userId, organizationId, serviceId, JSON.stringify(update));
      let subscription = await this.getSubscription(txId, userId, organizationId, serviceId, SUBSCRIPTION_ENTITIES.ORGANIZATION, organizationId);
      subscription = subscription && subscription.toObject();
      logger.taggedInfo({tag: txId}, 'Existing subscription', subscription && subscription._id);

      let processingContext: common.SubscriptionProcessingContext = await common.makeInitialProcessingSubscription(
        subscription && subscription._id,
        serviceId,
        SUBSCRIPTION_ENTITIES.ORGANIZATION,
        organizationId,
        subscription && subscription.allocations,
        models
      );
      logger.taggedInfo({tag: txId}, 'Processing subscription update context created');

      processingContext = await common.resolvePricesForProcessingSubscription(processingContext);
      logger.taggedInfo({tag: txId}, 'Processing subscription update context prices resolved');
      processingContext = await common.calculateAllocationsForProcessingSubscriptionUpdate(processingContext, update, toRoundedNumber(this.getMonthlyPriceModifier()), models);
      logger.taggedInfo({tag: txId}, 'Processing subscription update context allocations calculated', JSON.stringify(processingContext.state.getCalculatedValues()));
      processingContext = await common.deriveUpdatesForProcessingSubscriptionUpdate(processingContext, models);
      logger.taggedInfo({tag: txId}, 'Processing subscription update context operations derived', JSON.stringify(processingContext.state.getUpdateOperations()));
      const operations = await models.SubscriptionOperationsModel.create({operations: processingContext.state.getUpdateOperations()});
      logger.taggedInfo({tag: txId}, 'Processing subscription update context operations entry created', operations._id);
      const paymentHistory = await common.makePaymentHistory([processingContext], operations._id, false, userId);
      logger.taggedInfo({tag: txId}, 'Processing subscription update context payment history formed');
      const paymentHistoryEntry = await models.PaymentHistoryModel.create(paymentHistory);
      logger.taggedInfo({tag: txId}, 'Processing subscription update context payment history entry created', paymentHistoryEntry._id);
      const transaction = await this.treasuryService.chargeFiatAccountCard(
        update.accountId,
        parseFloat(paymentHistory.totalBillAmount.toString()),
        current,
        // TODO description
        '',
        {
          service: 'BILLING_MANAGER_WORKER',
          module: 'BILLING',
          additionalInfo: [
            {
              name: 'paymentHistory',
              value: paymentHistoryEntry._id.toString()
            }
          ]
        }
      );
      logger.taggedInfo({tag: txId}, 'Processing subscription update context transaction call made, status: ', transaction.status);

      if (transaction) {
        await models.PaymentHistoryModel.update({_id: paymentHistoryEntry._id}, {$set: {transaction: transaction._id}});
      }

      if (transaction && transaction.status === Transaction.StatusEnum.SUCCESS) {
        logger.taggedInfo({tag: txId}, 'Processing subscription update context transaction status success, performing updates');
        // TODO mongodb transaction after mongodb version update
        await common.udpateFromOps(operations._id.toString(), models, db);
        logger.taggedInfo({tag: txId}, 'Processing subscription update context transaction status success, updates performed');

        // generate invoice pdf and save to drive
        try {
          const doc: {signedUrl: string, _id: string} = await invoice.generatePDF(
            organizationId,
            'UPDATE',
            paymentHistoryEntry.toObject(),
            db,
            this.redisService,
            environment.service._id,
            SERVICE_HTTP_COMMUNICATION_BASE_HOST
          );
          await models.PaymentHistoryModel.update({_id: paymentHistoryEntry._id}, {$set: {invoice: doc}});
        } catch (err) {
          logger.taggedInfo({tag: txId}, 'Error generating pdf', err.message);
        }
        return true;
      } else {
        throw new ErrorUndefinedState(`Transaction unsuccessfull: ${transaction.status}`);
      }
    } catch (err) {
      logger.taggedInfo({tag: txId}, err.message);
      throw err;
    }
  }

  async deleteSubscription(subscriptionId: string) {
    if (!subscriptionId) {
      throw new ErrorBadInput('Subscription id is required');
    }
    return await SubscriptionSchema.deleteOne({_id: subscriptionId});
  }

  async updateSeatsCount(current: Current, userId: string, organizationId: string, updateSeats: SubscriptionAddUsers) {
    const txId = `[${crypto.randomBytes(16).toString('hex')}]`;
    logger.taggedInfo({tag: txId}, 'Update subscriptions started', userId, organizationId, JSON.stringify(updateSeats));
    logger.taggedInfo({tag: txId}, 'Processing subscriptions update transforming incoming data');
    const updateInners = updateSeats.services.map(s => {
      const upd = new common.SubscriptionUpdatePayload;
      upd.service = s.service;

      const alloc = new common.SubscriptionUpdateAllocationPayload;
      alloc.billingInterval = s.billingInterval;
      alloc.changedQuantity = s.changedQuantity;
      alloc.itemReference = s.itemReference;
      alloc.itemType = s.itemType;
      upd.allocations = [alloc];
      upd.updateOneTimeTotalPrice = s.updateOneTimeTotalPrice;
      return upd;
    });
    logger.taggedInfo({tag: txId}, 'Processing subscriptions update data transformed, deriving contexts');
    const ctxs = await Promise.all(updateInners.map(async (update) => {
      try {
        const serviceId = update.service;
        if (!update) {
          throw new ErrorBadInput('Allocation object is required');
        }
        if (!serviceId) {
          throw new ErrorBadInput('Service id is required');
        }
        logger.taggedInfo({tag: txId}, `Processing ${update.service} subscription update`);

        let subscription = await this.getSubscription(txId, userId, organizationId, serviceId, SUBSCRIPTION_ENTITIES.ORGANIZATION, organizationId);
        subscription = subscription && subscription.toObject();
        logger.taggedInfo({tag: txId}, `Processing ${update.service} subscription update, existing subscription ${subscription && subscription._id}`);

        let processingContext: common.SubscriptionProcessingContext = await common.makeInitialProcessingSubscription(
          subscription && subscription._id,
          serviceId,
          SUBSCRIPTION_ENTITIES.ORGANIZATION,
          organizationId,
          subscription && subscription.allocations,
          models
        );
        logger.taggedInfo({tag: txId}, `Processing ${update.service} subscription update context created`);
        processingContext = await common.resolvePricesForProcessingSubscription(processingContext);
        logger.taggedInfo({tag: txId}, `Processing ${update.service} subscription update context prices resolved`);
        processingContext = await common.calculateAllocationsForProcessingSubscriptionUpdate(processingContext, update, toRoundedNumber(this.getMonthlyPriceModifier()), models);
        logger.taggedInfo({tag: txId}, `Processing ${update.service} subscription update allocations calculated: ${JSON.stringify(processingContext.state.getCalculatedValues())}`);
        processingContext = await common.deriveUpdatesForProcessingSubscriptionUpdate(processingContext, models);
        logger.taggedInfo({tag: txId}, `Processing ${update.service} subscription update context operations derived ${JSON.stringify(processingContext.state.getUpdateOperations())}`);
        return processingContext;
      } catch (err) {
        logger.taggedInfo({tag: txId}, err.message);
        throw err;
      }
    }));
    logger.taggedInfo({tag: txId}, 'Processing subscriptions update contexts derived');
    try {
      const operations = await models.SubscriptionOperationsModel.create({
        operations: ctxs.reduce((a, ctx) => {
          a = a.concat(ctx.state.getUpdateOperations());
          return a;
        }, [])
      });
      logger.taggedInfo({tag: txId}, 'Processing subscriptions update operations entry created', operations._id);
      const paymentHistory = await common.makePaymentHistory(ctxs, operations._id, false, userId);
      logger.taggedInfo({tag: txId}, 'Processing subscriptions update payment history formed');
      const paymentHistoryEntry = await models.PaymentHistoryModel.create(paymentHistory);
      logger.taggedInfo({tag: txId}, 'Processing subscriptions update payment history entry created', paymentHistoryEntry._id);
      const transaction = await this.treasuryService.chargeFiatAccountCard(
        updateSeats.accountId,
        parseFloat(paymentHistory.totalBillAmount.toString()),
        current,
        // TODO description
        '',
        {
          service: 'BILLING_MANAGER_WORKER',
          module: 'BILLING',
          additionalInfo: [
            {
              name: 'paymentHistory',
              value: paymentHistoryEntry._id.toString()
            }
          ]
        }
      );
      logger.taggedInfo({tag: txId}, 'Processing subscriptions update transaction status', transaction && transaction.status);

      if (transaction) {
        await models.PaymentHistoryModel.update({_id: paymentHistoryEntry._id}, {$set: {transaction: transaction._id}});
      }

      if (transaction && transaction.status === Transaction.StatusEnum.SUCCESS) {
        // TODO mongodb transaction after mongodb version update
        logger.taggedInfo({tag: txId}, 'Processing subscriptions update transaction status success, performing updates');
        await common.udpateFromOps(operations._id, models, db);
        logger.taggedInfo({tag: txId}, 'Processing subscriptions update transaction status success, updates performed');
        // generate invoice pdf and save to drive
        try {
          const doc: {signedUrl: string, _id: string} = await invoice.generatePDF(
            organizationId,
            'UPDATE',
            paymentHistoryEntry.toObject(),
            db,
            this.redisService,
            environment.service._id,
            SERVICE_HTTP_COMMUNICATION_BASE_HOST
          );
          await models.PaymentHistoryModel.update({_id: paymentHistoryEntry._id}, {$set: {invoice: doc}});
        } catch (err) {
          logger.taggedInfo({tag: txId}, 'Error generating pdf', err.message);
        }
        return true;
      } else {
        throw new ErrorUndefinedState(`Transaction unsuccessfull: ${transaction.status}`);
      }
    } catch (err) {
      logger.taggedInfo({tag: txId}, err.message);
      throw err;
    }
  }

  getMonthlyPriceModifier() {
    const a = moment().endOf('month');
    let b = moment().subtract(1, 'days');
    const c = moment();
    if (c.isSame(b, 'month') !== true) {
      b = c;
    }
    const monthlyPriceMultiplier =  a.diff(b, 'days') / b.daysInMonth();
    if (typeof monthlyPriceMultiplier === 'number' && Number.isFinite && monthlyPriceMultiplier > 0) {
      return monthlyPriceMultiplier;
    }
    throw new ErrorUndefinedState('Was not able to derive monthly price multiplier');
  }
}
