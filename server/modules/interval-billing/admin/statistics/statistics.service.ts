import Container, { Service } from 'typedi';
import { BillingUsageService } from '../../usage/billing-usage.service';
import { environment } from '../../../../environment';
import moment = require('moment');
import * as _ from 'lodash';
import { Transaction } from '@aitheon/treasury-server';
import { TreasuryService } from '../../../treasury/treasury.service';
import { BillingUsage } from '../../usage/billing-usage.model';


@Service()
export class StatisticsService {

  private usageService: BillingUsageService;
  private treasuryService: TreasuryService;

  constructor() {
    this.usageService = Container.get(BillingUsageService);
    this.treasuryService = Container.get(TreasuryService);
  }


  async findByDate(start: string, end: string) {

    const billingIntervalInMin = environment.billingIntervalSeconds / 60;
    const transactions = await this.treasuryService.listBillingTransactions(undefined, undefined, start, end);

    // TODO: Change to TypeEnum
    let paidUsages = transactions.filter(t => t.type.toString() === 'BILL')
            .map(t => t.usages).reduce((curr, prev) => prev.concat(curr), []) as BillingUsage[];

    paidUsages = paidUsages.map((u => {
      u.requestTime = this.roundDate(new Date(u.requestTime), moment.duration(billingIntervalInMin, 'minutes')).toDate();
      return u;
    }));

    const paidStats: any[] = [];
    paidUsages.reduce((results, currentValue) => {
      const time = currentValue.requestTime.getTime().toString();
      if (!results[time]) {
        results[time] = {total: 0, requestTime: currentValue.requestTime};
        paidStats.push(results[time]);
      }
      results[time].total = results[time].total + currentValue.billing.total;
      return results;
    }, {} as any);


    let trialUsages  = transactions.filter(t => t.type.toString() === 'TRIAL_BILL')
    .map(t => t.usages).reduce((curr, prev) => prev.concat(curr), []) as BillingUsage[];

    trialUsages = trialUsages.map((u => {
      u.requestTime = this.roundDate(new Date(u.requestTime), moment.duration(billingIntervalInMin, 'minutes')).toDate();
      return u;
    }));

    const trialStats: any[] = [];
    trialUsages.reduce((results, currentValue) => {
      const time = currentValue.requestTime.getTime().toString();
      if (!results[time]) {
        results[time] = {total: 0, requestTime: currentValue.requestTime};
        trialStats.push(results[time]);
      }
      results[time].total = results[time].total + currentValue.billing.total;
      return results;
    }, {} as any);

    return {paidStats, trialStats};
  }




  async findByService(start: Date, end: Date) {

    const transactions = await this.treasuryService.listBillingTransactions(undefined, undefined, start.toISOString(), end.toISOString());
    const billingIntervalInMin = environment.billingIntervalSeconds / 60;

    let paidUsages = transactions.filter(t => t.type.toString() === 'BILL')
            .map(t => t.usages).reduce((curr, prev) => prev.concat(curr), []) as BillingUsage[];

    paidUsages = paidUsages.map(u => {
      u.requestTime = this.roundDate(new Date(u.requestTime), moment.duration(billingIntervalInMin, 'minutes')).toDate();
      return u;
    });

    const paidStats: any[] = [];
    paidUsages.reduce((results, currentValue) => {
      if (!results[currentValue.service]) {
        results[currentValue.service] = {total: 0, service: currentValue.service};
        paidStats.push(results[currentValue.service]);
      }
      results[currentValue.service].total = results[currentValue.service].total + currentValue.billing.total;
      return results;
    }, {} as any);

    for (const stats of paidStats) {
      stats.usages = paidUsages.filter(u => u.service === stats.service);
    }


    // TODO: Change to TypeEnum
    let trialUsages = transactions.filter(t => t.type.toString() === 'TRIAL_BILL')
            .map(t => t.usages).reduce((curr, prev) => prev.concat(curr), []) as BillingUsage[];


    trialUsages = trialUsages.map(u => {
      u.requestTime = this.roundDate(new Date(u.requestTime), moment.duration(billingIntervalInMin, 'minutes')).toDate();
      return u;
    });

    const trialStats: any[] = [];
    trialUsages.reduce((results, currentValue) => {
      if (!results[currentValue.service]) {
        results[currentValue.service] = {total: 0, service: currentValue.service};
        trialStats.push(results[currentValue.service]);
      }
      results[currentValue.service].total = results[currentValue.service].total + currentValue.billing.total;
      return results;
    }, {} as any);

    for (const stats of trialStats) {
      stats.usages = trialUsages.filter(u => u.service === stats.service);
    }

    return {trialStats, paidStats};

  }

  private roundDate(date: Date, duration: any)  {
    return moment(Math.ceil((+date) / (+duration)) * (+duration));
  }



}
