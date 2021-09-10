import {
  Subscription,
  SubscriptionItem,
  UpdateOperation,
  OPERATION_TYPE,
  SubSubscriptionItem,
  SUBSCRIPTION_ITEM_TYPE,
  SUBSCRIPTION_STATUS
} from '../index';
import { ObjectID } from 'mongodb';
import { Models, SubscriptionProcessingContext } from './shared-structures';
import * as subscriptions from './subscriptions';

export function traverseMut(o: any, pt: any, key: any) {
  if (typeof o !== 'object') {
    return;
  }
  if (o._type && o._value) {
    switch (o._type) {
      case 'datestring': {
        pt && typeof key !== 'undefined' && key !== null && (pt[key] = new Date(o._value));
        break;
      }
      case 'objectid': {
        pt && typeof key !== 'undefined' && key !== null && (pt[key] = new ObjectID(o._value));
        break;
      }
    }
  } else if (o.constructor === Array) {
    o.forEach((oi: any, i: any) => {traverseMut(oi, o, i); });
  } else {
    for (const i in o) {
      if (o[i] !== null && typeof(o[i]) === 'object' && !(o[i] instanceof ObjectID) && i !== '_type' && i !== '_value') {
        traverseMut(o[i], o, i);
      }
    }
  }
}

export function opCreateSubscription(subscription: Subscription) {
  const updateOp = new UpdateOperation();
  updateOp.query = undefined;
  updateOp.op = OPERATION_TYPE.CREATE;
  updateOp.o = subscription;
  return updateOp;
}

export function opCreateAllocation(subscriptionId: string, allocation: SubscriptionItem) {
  const updateOp = new UpdateOperation();
  updateOp.query = JSON.stringify({_id: {_type: 'objectid', _value: subscriptionId}});
  updateOp.op = OPERATION_TYPE.UPDATE;
  const allocationForOp: any = {
    _id: {_type: 'objectid', _value: allocation._id},
    itemType: allocation.itemType,
    itemReference: {_type: 'objectid', _value: allocation.itemReference},
    billingInterval: allocation.billingInterval,
    lastRenewDate: new Date(),
    quantity: allocation.quantity,
    subAllocations: allocation.subAllocations || []
  };
  if (allocation.service) {
    allocationForOp.service = allocation.service;
  }
  updateOp.o = JSON.stringify([{$push: {'allocations': allocationForOp}}]);
  return updateOp;
}

export function opCreateOriginAllocation(subscriptionId: string, originAllocation: SubscriptionItem) {
  const updateOp = new UpdateOperation();
  updateOp.query = JSON.stringify({_id: {_type: 'objectid', _value: subscriptionId}});
  updateOp.op = OPERATION_TYPE.UPDATE;
  const allocationForOp: any = {
    _id: {_type: 'objectid', _value: originAllocation._id},
    itemType: originAllocation.itemType,
    itemReference: {_type: 'objectid', _value: originAllocation.itemReference},
    billingInterval: originAllocation.billingInterval,
    lastRenewDate: new Date(),
    quantity: originAllocation.quantity,
    subAllocations: originAllocation.subAllocations || []
  };
  if (originAllocation.service) {
    allocationForOp.service = originAllocation.service;
  }
  updateOp.o = JSON.stringify([{$push: {'allocations': allocationForOp}}]);
  return updateOp;
}

export function opCreateSuballocation(subscriptionId: string, originAllocationId: string, suballocation: SubSubscriptionItem) {
  const updateOp = new UpdateOperation();
  updateOp.query = JSON.stringify({_id: {_type: 'objectid', _value: subscriptionId}});
  updateOp.op = OPERATION_TYPE.UPDATE;
  const subAllocationForOp: any = {
    _id: {_type: 'objectid', _value: suballocation._id},
    quantity: suballocation.quantity,
    service: suballocation.service
  };
  updateOp.o = JSON.stringify([{$push: {'allocations.$[j].subAllocations': subAllocationForOp}}, {arrayFilters: [{'j._id': {_type: 'objectid', _value: originAllocationId}}]}]);
  return updateOp;
}

export function opUpdateAllocation(subscriptionId: string, allocationId: string, updateObject: Partial<SubscriptionItem>) {
  const updateOp = new UpdateOperation();
  updateOp.query = JSON.stringify({_id: {_type: 'objectid', _value: subscriptionId}});
  updateOp.op = OPERATION_TYPE.UPDATE;
  const update: any = {$set: {}};
  if (updateObject.lastRenewDate) {
    update['$set']['allocations.$[j].lastRenewDate'] = {_type: 'datestring', _value: updateObject.lastRenewDate};
  }
  if (typeof updateObject.quantity === 'number' && Number.isFinite(updateObject.quantity) === true) {
    update['$set']['allocations.$[j].quantity'] = updateObject.quantity;
  }
  updateOp.o = JSON.stringify([update, {arrayFilters: [{'j._id': {_type: 'objectid', _value: allocationId}}]}]);
  return updateOp;
}

export function opUpdateSuballocation(subscriptionId: string, allocationId: string, id: string, updateObject: Partial<SubSubscriptionItem>, timestamp: Date) {
  const updateOp = new UpdateOperation();
  updateOp.query = JSON.stringify({_id: {_type: 'objectid', _value: subscriptionId}});
  updateOp.op = OPERATION_TYPE.UPDATE;
  const update: any = {$set: {}};
  if (typeof updateObject.quantity === 'number' && Number.isFinite(updateObject.quantity) === true) {
    update['$set']['allocations.$[j].subAllocations.$[m].quantity'] = updateObject.quantity;
  }
  if (timestamp) {
    update['$set']['allocations.$[j].lastRenewDate'] = {_type: 'datestring', _value: timestamp};
  }
  updateOp.o = JSON.stringify([update, {arrayFilters: [{'j._id': {_type: 'objectid', _value: allocationId}}, {'m._id': {_type: 'objectid', _value: id}}]}]);
  return updateOp;
}

export async function formUpdateOperations(
  processingContext: SubscriptionProcessingContext,
  models: Models
): Promise<UpdateOperation[]> {
  const ops: UpdateOperation[] = [];

  const pendingSubscriptionCreates: {[key: string]: Subscription} = {};

  if (!processingContext.subscriptionId) {
    const skey = `${processingContext.entity}|${processingContext.entityReference}|${processingContext.service}`;
    if (!pendingSubscriptionCreates[skey]) {
      // create subscription if not exists
      processingContext.subscriptionId = new ObjectID().toHexString();
      processingContext.allocations = {};
      const subscription = subscriptions.createSubscription(processingContext.subscriptionId, processingContext.entity, processingContext.entityReference, processingContext.service);
      ops.push(opCreateSubscription(subscription));
      pendingSubscriptionCreates[skey] = subscription;
    }
  }

  const timestamp = new Date();

  await Promise.all(Object.entries(processingContext.state.getCalculatedValues().allocations).map(async ([key, upd]) => {
    const price = processingContext.state.getResolvedPrices()[key];
    const [bi, itemReference, it] = key.split('|');
    const billingInterval: number = parseInt(bi);
    const itemType: SUBSCRIPTION_ITEM_TYPE = SUBSCRIPTION_ITEM_TYPE[it as keyof typeof SUBSCRIPTION_ITEM_TYPE];
    if (typeof billingInterval !== 'number' || Number.isFinite(billingInterval) !== true) {
      throw new Error(`Could not derive billingInterval from ${key}`);
    }
    if (!itemType) {
      throw new Error(`Could not derive itemType from ${key}`);
    }
    let targetAllocation = Object.values(processingContext.allocations).find(alloc => alloc.billingInterval === billingInterval && alloc.itemReference === itemReference && alloc.itemType === itemType);
    if (price.service !== processingContext.service) {
      // update is a suballocation
      if (!targetAllocation) {
        // allocation dont exist
        // create new allocation
        const allocationId = new ObjectID().toHexString();
        const allocation = subscriptions.createAllocation(allocationId, billingInterval, itemReference, itemType, undefined, timestamp, price.service);
        targetAllocation = allocation;
        ops.push(opCreateAllocation(processingContext.subscriptionId, allocation));
      } else {
        ops.push(opUpdateAllocation(processingContext.subscriptionId, targetAllocation._id, {lastRenewDate: new Date}));
      }
      const originAllocationSubscription = await subscriptions.getSubscription(processingContext.entity, processingContext.entityReference, price.service, models);
      if (!originAllocationSubscription) {

        const skey = `${processingContext.entity}|${processingContext.entityReference}|${price.service}`;
        let originAllocationSubscription = undefined;
        if (!pendingSubscriptionCreates[skey]) {
          // create subscription for originAllocation
          const subscriptionId = new ObjectID().toHexString();
          originAllocationSubscription = subscriptions.createSubscription(subscriptionId, processingContext.entity, processingContext.entityReference, price.service);
          ops.push(opCreateSubscription(originAllocationSubscription));
          pendingSubscriptionCreates[skey] = originAllocationSubscription;
        } else {
          originAllocationSubscription = pendingSubscriptionCreates[skey];
        }
        const originAllocationId = new ObjectID().toHexString();
        const originAllocation = subscriptions.createOriginAllocation(originAllocationId, billingInterval, itemReference, itemType, upd.calculatedQuantity, processingContext.service);
        ops.push(opCreateOriginAllocation(originAllocationSubscription._id, originAllocation));
        const suballocationId = upd.suballocationId;
        const suballocation = subscriptions.createSubAllocation(processingContext.service, suballocationId, upd.calculatedQuantity);
        ops.push(opCreateSuballocation(originAllocationSubscription._id, originAllocation._id, suballocation));
      } else {
        // check if suballocation exists
        const originAllocation = originAllocationSubscription.allocations.find((origalloc) => origalloc.billingInterval === targetAllocation.billingInterval && origalloc.itemReference === targetAllocation.itemReference && origalloc.itemType === targetAllocation.itemType);
        if (!originAllocation) {
          // create suballocation
          const originAllocationId = new ObjectID().toHexString();
          const originAllocation = subscriptions.createOriginAllocation(originAllocationId, billingInterval, itemReference, itemType, upd.calculatedQuantity, processingContext.service);
          ops.push(opCreateOriginAllocation(originAllocationSubscription._id, originAllocation));
          const suballocationId = upd.suballocationId;
          const suballocation = subscriptions.createSubAllocation(processingContext.service, suballocationId, upd.calculatedQuantity);
          ops.push(opCreateSuballocation(originAllocationSubscription._id, originAllocation._id, suballocation));
        } else {
          // update suballocation
          // check if suballocation exists on origin allocation
          const available = originAllocation.quantity - originAllocation.subAllocations.reduce((a, sa) => {
            if (typeof sa.quantity === 'number' && Number.isFinite(sa.quantity) === true) {
              a += sa.quantity;
            }
            return a;
          }, 0);
          const coveredByAvailable = (available >= upd.calculatedQuantity);
          let suballocation = originAllocation.subAllocations.find(suballoc => suballoc.service === processingContext.service);
          if (!suballocation) {
            const suballocationId = upd.suballocationId;
            suballocation = subscriptions.createSubAllocation(processingContext.service, suballocationId, upd.calculatedQuantity);
            ops.push(opCreateSuballocation(originAllocationSubscription._id, originAllocation._id, suballocation));
            if (coveredByAvailable !== true) {
              // update both origin allocation quantity and suballocation quantity
              const originQuantityChange = (originAllocation.quantity + upd.calculatedQuantity - available);
              ops.push(opUpdateAllocation(originAllocationSubscription._id, originAllocation._id, {quantity: originQuantityChange, lastRenewDate: timestamp}));
            }
          } else {
            if (coveredByAvailable !== true) {
              // update both origin allocation quantity and suballocation quantity
              const originQuantityChange = (originAllocation.quantity + upd.calculatedQuantity - available);
              ops.push(opUpdateAllocation(originAllocationSubscription._id, originAllocation._id, {quantity: originQuantityChange, lastRenewDate: timestamp}));
            }
            const suballocQuantityChange = (suballocation.quantity + upd.calculatedQuantity);
            ops.push(opUpdateSuballocation(originAllocationSubscription._id, originAllocation._id, suballocation._id, {quantity: suballocQuantityChange}, timestamp));
          }
        }
      }
    } else {
        // update is not a suballocation
        if (!targetAllocation) {
          // allocation dont exist
          // create new allocation
          const allocationId = new ObjectID().toHexString();
          const allocation = subscriptions.createAllocation(allocationId, billingInterval, itemReference, itemType, upd.calculatedQuantity, timestamp);
          targetAllocation = allocation;
          ops.push(opCreateAllocation(processingContext.subscriptionId, allocation));
        } else {
          targetAllocation.quantity = targetAllocation.quantity + upd.calculatedQuantity;
          ops.push(opUpdateAllocation(processingContext.subscriptionId, targetAllocation._id, {quantity: targetAllocation.quantity, lastRenewDate: timestamp}));
        }
    }
  }));
  return ops;
}

export async function udpateFromOps(opsId: string, models: Models, db: any) {
  const ops = await models.SubscriptionOperationsModel.findById(opsId);
  await ops.operations.reduce((a: any, op: any) => {
    return a.then(async () => {
      switch (op.op) {
        case OPERATION_TYPE.CREATE: {
          await models.SubscriptionModel[OPERATION_TYPE.CREATE](op.o);
          break;
        }
        case OPERATION_TYPE.UPDATE: {
          op.query = JSON.parse(op.query);
          op.o = JSON.parse(op.o);
          traverseMut(op.query, undefined, undefined);
          traverseMut(op.o, undefined, undefined);
          const res = await db.connection.collection(models.SubscriptionModel.collection.name).update.apply(
            db.connection.collection(models.SubscriptionModel.collection.name),
            [(op.query)].concat(op.o)
          );
          break;
        }
      }
    });
  }, Promise.resolve());
}

export function formSubscriptionOperations(calculatedSubscriptions: SubscriptionProcessingContext[], ts: Date) {
  const operations: UpdateOperation[] = [];
  calculatedSubscriptions.forEach(cs => {
    const op = new UpdateOperation;
    op.query = JSON.stringify({ _id: { _type: 'objectid', _value: cs.subscriptionId } });
    op.op = OPERATION_TYPE.UPDATE;
    const allocs = Object.keys(cs.state.getCalculatedValues().allocations).map(a => ({ _type: 'objectid', _value: cs.allocations[a]._id }));
    op.o = JSON.stringify([{ $set: { status: SUBSCRIPTION_STATUS.ACTIVE, 'allocations.$[j].lastRenewDate': { _type: 'datestring', _value: ts } } }, { arrayFilters: [{ 'j._id': { $in: allocs } }] }]);
    operations.push(op);
  });
  return operations;
}

export function formStatusOperations(calculatedSubscriptions: SubscriptionProcessingContext[], ts: Date, status: SUBSCRIPTION_STATUS) {
  const operations: UpdateOperation[] = [];
  calculatedSubscriptions.forEach(cs => {
    const op = new UpdateOperation;
    op.query = JSON.stringify({ _id: { _type: 'objectid', _value: cs.subscriptionId } });
    op.op = OPERATION_TYPE.UPDATE;
    op.o = JSON.stringify([{ $set: { status}}]);
    operations.push(op);
  });
  return operations;
}
