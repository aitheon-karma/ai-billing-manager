
import { Service, Inject } from 'typedi';
import { BillingUsage, BillingUsageSchema } from './billing-usage.model';
import moment = require('moment');
import * as mongoose from 'mongoose';
const ObjectId = mongoose.Types.ObjectId;


@Service()
export class BillingUsageService {

  create(billingUsage: BillingUsage) {
    return BillingUsageSchema.create(billingUsage);
  }

  pendingUsageCursor() {
    return BillingUsageSchema.find({ 'billing.charged': false, usageByTime: { '$lte': new Date() } }).cursor();
  }

  findOne(_id: string) {
    return BillingUsageSchema.findById({ _id });
  }

  update(usage: BillingUsage) {
    return BillingUsageSchema.updateOne({ _id: usage._id }, usage);

  }

  findMultiple(usageIds: string[]) {
    return BillingUsageSchema.find({ _id: { $in: usageIds } });
  }

  findByRequestTime(start: Date, end: Date, select: string): Promise<BillingUsage[]> {
    return BillingUsageSchema.find({ requestTime: { $gte: start, $lte: end } }, select).lean() as any;
  }

  findByByUserAndOrg(start: Date, end: Date, user: string, organization: string) {
    const query = usageByDateQuery(start, end, user, organization);
    return BillingUsageSchema.aggregate(query);
  }

}


const usageByDateQuery = (startDate: Date, endDate: Date, user: string, organization: string) => {

  const matchQuery: any = { 'billing.charged': true, '$and': [ { requestTime: {'$gte': startDate}  }, { requestTime: {'$lte': endDate} }] };

  if (!organization) {
    matchQuery.user = new ObjectId(user);
    // tslint:disable-next-line: no-null-keyword
    matchQuery.organization = null;
  } else {
    matchQuery.organization = new ObjectId(organization);
  }

  return [
    {
      $match: matchQuery
    },
    {
      $group: {
        '_id': { 'user': '$user', 'organization': '$organization' },
        'amount': { '$sum': '$billing.total' },
        'usages': {
          $push: {
            _id: '$_id',
            billing: { pricePerSecond: '$billing.pricePerSecond', total: '$billing.total' },
            service: '$service',
            usageByTime: '$usageByTime',
            requestTime: '$requestTime'
          }
        }
      }
    },
    {
      $lookup : {
        from: 'users',
        localField: '_id.user',
        foreignField: '_id',
        as: '_id.user',
      }
    },
    {
      $unwind: '$_id.user'
    },
    {
      $project: {
        from: {
          user: {
            profile: { firstName:  '$_id.user.profile.firstName', lastName: '$_id.user.profile.lastName' },
            _id: '$_id.user._id'
          },
          organization: '$_id.organization'
        },
        amount: 1,
        usages: 1,
        _id: 0,
     }
    }
  ];
};

