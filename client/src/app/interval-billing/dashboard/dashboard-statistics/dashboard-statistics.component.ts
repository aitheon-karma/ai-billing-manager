import { Component, OnInit, OnChanges, OnDestroy, Input, SimpleChanges } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { TableColumn } from '../../shared/interfaces/table-column.interface';
import { IntervalSharedService } from '../../shared/interval-shared.service';
import { BillingUsagesRestService } from '@aitheon/billing-manager';

import * as moment from 'moment';

@Component({
  selector: 'ai-dashboard-statistics',
  templateUrl: './dashboard-statistics.component.html',
  styleUrls: ['./dashboard-statistics.component.scss']
})
export class DashboardStatisticsComponent implements OnInit, OnChanges, OnDestroy {

  @Input() transactions = [];

  listColumns: TableColumn[] = [
    {
      key: 'label',
      flex: 3,
      title: 'Service name',
      disableSort: true,
    },
    {
      title: 'Overall hours',
      key: 'overallTime',
      formatter: this.sharedService.formatTime,
      flex: 2,
    },
    {
      title: 'Avg Rate',
      key: 'hourRate',
      flex: 2,
      uom: 'ACU',
      formatter: this.sharedService.roundNumber,
    },
    {
      title: 'Overall cost',
      key: 'overallCost',
      flex: 3,
      uom: 'ACU',
      formatter: this.sharedService.roundNumber,
    },
    {
      flex: 1,
    },
    {
      flex: 1,
      label: 'info',
      callback: this.redirectToDetails.bind(this),
      disableSort: true,
    },
  ];

  dateRange: FormControl;
  formSubscription: Subscription;
  transactionCollection = [];
  billingStatistics = [];
  activeButton = 'today';
  loading = true;
  readonly currentDate = new Date();

  constructor(
    private router: Router,
    private billingUsagesRestService: BillingUsagesRestService,
    private sharedService: IntervalSharedService,
  ) {}

  ngOnInit() {
    this.dateRange = new FormControl([null, null], Validators.required);
    this.onDateRangeChanges();
  }

  ngOnChanges(changes: SimpleChanges) {
    const transactions = <any>changes.transactions;
    if (transactions && transactions.currentValue) {
      this.setTransactionsCollection(transactions.currentValue);
      this.loading = false;
    }
  }

  updateOptions() {
    this.loading = true;
    let fromDate;
    let toDate = new Date().toISOString();
    if (this.dateRange.valid) {
      fromDate = moment(this.dateRange.value[0]).add(12, 'h').toISOString();
      toDate = moment(this.dateRange.value[1]).add(12, 'h').toISOString();
    } else {
      fromDate = this.getFromDate(true).toISOString();
    }
    this.billingUsagesRestService.usagesByDate(fromDate, toDate)
      .subscribe(transactions => {
        this.setTransactionsCollection(transactions);
        this.loading = false;
      });
  }

  onDateRangeChanges() {
    this.formSubscription = this.dateRange.valueChanges
      .subscribe(() => {
        this.updateOptions();
      });
  }

  setTransactionsCollection(transactions: any) {
    const transactionCollection = transactions
      .reduce((usages, transaction: any) => [...usages, ...transaction.usages], [])
      .reduce((result, usage) => {
        // @ts-ignore
        const { requestTime, usageByTime, billing, service } = usage;
        // @ts-ignore
        const { pricePerSecond, total } = billing || {};
        const currentService = result[service] || {};
        const currentServiceRecords = currentService.records || [];
        const newRecord = {
          date: new Date(requestTime),
          hourRate: pricePerSecond * 3600,
          usageTime: this.getTimeDifference(usageByTime, requestTime),
          cost: total,
        };
        return {
          ...result,
          [service]: {
            label: this.getServiceLabel(service),
            serviceName: service,
            records: [...currentServiceRecords, newRecord],
          },
        };
      }, {});
    this.transactionCollection = Object.values(transactionCollection);
    this.setBillingStatistics();
  }

  setBillingStatistics() {
    const dateRange = this.dateRange.value;
    const statistics = [];
    this.transactionCollection.forEach((transaction) => {
      const { records, label, serviceName } = transaction;
      const record = records.reduce((result, current) => {
        if (this.checkDate(current.date, dateRange)) {
          return {
            label,
            serviceName,
            overallTime: (result.overallTime || 0) + current.usageTime,
            hourRate: result.hourRate
              ? [...result.hourRate, current.hourRate]
              : [current.hourRate],
            overallCost: (result.overallCost || 0) + current.cost,
          };
        }
        return result;
      }, {});
      if (Object.keys(record).length) {
        statistics.push(record);
      }
    });
    this.billingStatistics = statistics.map(({ hourRate, ...restItem }) => {
      return {
        ...restItem,
        hourRate: hourRate.reduce((a, b) => a + b, 0) / hourRate.length,
      };
    });
  }

  getTimeDifference(from: string, to: string) {
    if (from && to) {
      const fromDate = new Date(from);
      const toDate = new Date(to);
      return Number(fromDate) - Number(toDate);
    }
  }

  getServiceLabel(serviceName: string) {
    return serviceName.split('_')
      .map(word => {
        if (word === 'HR' || word === 'OMS') {
          return word;
        }
        return `${word.slice(0, 1) + word.slice(1).toLowerCase()}`;
      }).join(' ');
  }

  checkDate(recordDate: Date, dateRange: []) {
    if (dateRange && dateRange.find(item => (item !== null))) {
      // @ts-ignore
      const [from, to] = dateRange;
      const format = date => moment(date).format('YYYY-MM-DD');
      if (format(recordDate) >= format(from)) {
        if (format(recordDate) <= format(to)) {
          return true;
        }
      }
      return false;
    }
    return true;
  }

  getFromDate(setCurrent?: boolean): Date {
    let from = setCurrent ? moment().toDate() : moment().startOf('day').toDate();
    if (this.activeButton === 'month') {
      from = moment().subtract(1, 'months').toDate();
    }
    if (this.activeButton === 'week') {
      from = moment().subtract(7, 'd').toDate();
    }
    if (this.activeButton === 'today') {
      from = moment().toDate();
    }
    return from;
  }

  onChangeDateRange(dateRange: string, event: Event) {
    event.stopPropagation();
    event.preventDefault();

    this.activeButton = dateRange;
    if (dateRange === 'today') {
      this.dateRange.setValue([new Date(), new Date()]);
    }
    if (dateRange === 'week') {
      const prevDate = moment().subtract(7, 'd').format();
      this.dateRange.setValue([new Date(prevDate), new Date()]);
    }
    if (dateRange === 'month') {
      const prevDate = moment().subtract(1, 'months').format();
      this.dateRange.setValue([new Date(prevDate), new Date()]);
    }
  }

  redirectToDetails(row: any) {
    const { serviceName } = row;
    if (serviceName) {
      this.router.navigate(['statistics', 'services', `${serviceName.toLowerCase()}`]);
    }
  }

  clearActiveButton(event) {
    event.stopPropagation();
    event.preventDefault();

    this.activeButton = null;
  }

  clearFormControl(event: Event) {
    event.stopPropagation();
    event.preventDefault();

    this.activeButton = 'today';
    this.dateRange.setValue(null);
  }

  ngOnDestroy(): void {
    this.formSubscription.unsubscribe();
  }
}
