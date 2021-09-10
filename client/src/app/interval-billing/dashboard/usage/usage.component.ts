import { Component, Input, OnChanges, OnInit, OnDestroy, SimpleChanges } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { Transaction } from '@aitheon/treasury';
import { Subscription } from 'rxjs';
import { BillingUsagesRestService } from '@aitheon/billing-manager';

import * as shape from 'd3-shape';
import * as moment from 'moment';

@Component({
  selector: 'ai-usage',
  templateUrl: './usage.component.html',
  styleUrls: ['./usage.component.scss']
})
export class UsageComponent implements OnInit, OnChanges, OnDestroy {

  @Input() transactions = [];

  activeButton = 'today';
  dateRange: FormControl;
  dateSubscription: Subscription;

  bsValue: any;
  maxDate: any;
  view: any[] = [740, 220];
  showXAxis = true;
  showYAxis = true;
  gradient = false;
  showLegend = false;
  showXAxisLabel = false;
  showYAxisLabel = false;
  yAxisLabel = 'Hours';
  roundDomains = true;
  yAxisTickFormattingFn = this.yAxisTickFormatting.bind(this);
  xAxisTickFormattingFn = this.xAxisTickFormatting.bind(this);
  curve: any = shape.curveMonotoneX;
  servicesUsage = [];
  loading = true;
  readonly currentDate = new Date();
  colorScheme = {
    domain: ['#dcbc65']
  };
  options: any = [
    {
      'name': 'Total Hours',
      'series': [],
    },
  ];

  constructor(
    private billingUsagesRestService: BillingUsagesRestService,
  ) {}

  ngOnInit(): void {
    this.dateRange = new FormControl([null, null], Validators.required);
    this.onDateRangeChanges();
  }

  ngOnChanges(changes: SimpleChanges) {
    const transactions = <any>changes.transactions;
    if (transactions && transactions.currentValue) {
      this.loading = false;
      this.setUsageCollection(transactions.currentValue);
    }
  }

  onDateRangeChanges() {
    this.dateSubscription = this.dateRange.valueChanges
      .subscribe(() => {
        this.activeButton = null;
        this.updateOptions();
      });
  }

  setUsageCollection(transactions: Transaction[]) {
    const usageObject = transactions
      .reduce((usages, transaction: any) => [...usages, ...transaction.usages], [])
      .reduce((result, usage) => {
        // @ts-ignore
        const { requestTime, usageByTime } = usage || {};
        const date = new Date(requestTime);
        const dateKey = moment(date).format('MMM-DD-hh-mm');
        const currentItem = result[dateKey] || {};
        return {
          ...result,
          [dateKey]: {
            date,
            name: dateKey,
            value: this.getHours(currentItem.value, this.getTimeDifference(usageByTime, requestTime))
          },
        };
      }, {});
    this.servicesUsage = Object.values(usageObject);
    this.filterOptions();
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
        this.setUsageCollection(transactions);
        this.loading = false;
      })
  }

  filterOptions() {
    const options = this.options[0];
    this.options = [{
      ...options,
      series: this.getSeries(),
    }];
  }

  getSeries() {
    if (this.dateRange.valid) {
      const dateRange = this.dateRange.value;
      const dayDifference = moment(dateRange[1]).diff(moment(dateRange[0]), 'days');
      if (dayDifference > 0 && dayDifference < 15) {
        return this.getSeriesBy('MMM DD', dateRange);
      }
      if (dayDifference > 14 && dayDifference < 62) {
        return this.getWeekOptions();
      }
      if (dayDifference > 61) {
        return this.getSeriesBy('MMM', dateRange);
      }
      return this.getSeriesBy('HH:mm', dateRange);
    }
    if (this.activeButton === 'monthly') {
      return this.getSeriesBy('MMM');
    }
    if (this.activeButton === 'weekly') {
      return this.getWeekOptions();
    }
    if (this.activeButton === 'daily') {
      return this.getSeriesBy('MMM DD');
    }
    this.activeButton = 'today';
    return this.getSeriesBy('HH:mm', [new Date(), new Date()]);
  }

  getWeekOptions() {
    const filteredServicesUsage = this.filterSeriesByDate();
    const weekMatrix = this.getWeekMatrix();
    return weekMatrix.map((dateRange: Date[], i) => {
      const [fromDate, to] = dateRange;
      const toDate = new Date(moment(to).subtract(1, 'd').format());
      const dateKey = `${moment(fromDate).format('MMM DD')} -- ${moment(toDate).format('MMM DD')}`;
      const value = filteredServicesUsage
        .filter(({ date }) => this.checkDate(date, dateRange))
        .reduce((a, b) => a + b.value, 0);
      return {
        name: dateKey,
        date: i === weekMatrix.length - 1 ? fromDate : toDate,
        value,
      };
    })
      .filter(({ date }) => {
        if (this.dateRange.valid && date) {
          return this.checkDate(date, this.dateRange.value);
        }
        return true;
      });
  }

  getSeriesBy(format, dateRange?) {
    const seriesObj = this.servicesUsage
      .filter(({ date }) => {
        if (dateRange) {
          const [from, to] = dateRange;
          return this.checkDate(
            date,
            [
              moment(from).startOf('day').toDate(),
              moment(to).endOf('day').toDate(),
            ],
          );
        }
        return true;
      })
      .reduce((result, usage) => {
        const { date, value } = usage;
        const dateKey = this.getDateKey(date, format);
        if (result[dateKey]) {
          return {
            ...result,
            [dateKey]: {
              name: dateKey,
              value: result[dateKey].value + value,
            },
          };
        }
        return {
          ...result,
          [dateKey]: {
            name: dateKey,
            value,
          }
        };
      }, {});
    return this.fillWithBlankValues(seriesObj, format);
  }

  filterSeriesByDate() {
    const dateRange = this.dateRange.value;
    return this.servicesUsage
      .filter(({ date }) => this.checkDate(date, dateRange));
  }

  fillWithBlankValues(collection: any, range: string) {
    if (!Object.keys(collection).length) {
      return collection;
    }
    const startDate = this.getStartDate();
    const datesMatrix = this.getDatesMatrix(startDate, range);
    return datesMatrix.map(dateKey => {
      if (collection[dateKey]) {
        return collection[dateKey]
      }
      return {
        name: dateKey,
        value: 0,
      };
    });
  }

  getDatesMatrix(startDate: any, range: string) {
    let fromDate = moment(startDate).startOf('d');
    const timeFormat = range === 'HH:mm' && 'm' || range === 'MMM DD' && 'd' || 'M';
    const timeStep = range === 'HH:mm' && 15 || 1;
    let toDate = moment();
    if (this.dateRange.valid) {
      toDate = moment(this.dateRange.value[1]).endOf('d');
    }
    const datesMatrix = [
      fromDate.format(range),
    ];
    do {
      fromDate = fromDate.add(timeStep, timeFormat);
      datesMatrix.push(fromDate.format(range));
    } while (toDate.diff(fromDate, timeFormat) >= timeStep);
    return datesMatrix;
  }

  onChangeDateRange(dateRange: string, event: Event) {
    event.stopPropagation();
    event.preventDefault();

    if (this.dateRange.valid) {
      this.dateRange.reset();
    }
    this.activeButton = dateRange;
    this.updateOptions();
  }

  yAxisTickFormatting(val) {
    return `${val} Hours`;
  }

  xAxisTickFormatting(val) {
    return val.replace('-', ' ');
  }

  getHours(previousValue: number = 0, currentValue: number = 0) {
    // getting value in hours from milliseconds
    return previousValue + (currentValue / 1000 / 60 / 60);
  }

  getTimeDifference(from: string, to: string) {
    if (from && to) {
      const fromDate = new Date(from);
      const toDate = new Date(to);
      return Number(fromDate) - Number(toDate);
    }
  }

  getStartDate() {
    if (this.dateRange.valid) {
      const [from] = this.dateRange.value;
      return from;
    } else {
      return this.getFromDate();
    }
  }

  getFromDate(setCurrent?: boolean): Date {
    let from = setCurrent ? moment().toDate() : moment().startOf('day').toDate();
    if (this.activeButton === 'monthly') {
      from = moment().subtract(6, 'months').toDate();
    }
    if (this.activeButton === 'weekly') {
      from = moment().subtract(2, 'months').toDate();
    }
    if (this.activeButton === 'daily') {
      from = moment().subtract(14, 'd').toDate();
    }
    return from;
  }

  getWeekMatrix(): any {
    const weekMatrix = [];
    let toDate = new Date();
    if (this.dateRange.valid) {
      const dateRange = this.dateRange.value;
      toDate = dateRange[1];
    }
    const prevDate = moment(toDate).subtract(2, 'months');
    let day = moment(prevDate.endOf('week')).add(1, 'd');
    const calcSaturday = () => {
      day = moment(day).add(7, 'd');
      const date = new Date(day.format());
      if (Number(date) > Number(new Date())) {
        return new Date(moment().add(1, 'd').format());
      }
      return new Date(day.format());
    };
    do {
      const week = [
        new Date(day.format()),
        calcSaturday(),
      ];
      weekMatrix.push(week);
    } while (Number(new Date(day.format())) < Number(toDate));
    return weekMatrix;
  }

  checkDate(recordDate: Date, dateRange: Date[]) {
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

  getDateKey(date: Date, format: string) {
    const formatted = moment(date).format(format);
    if (format === 'HH:mm') {
      const [hours, minutes] = formatted.split(':');
      const roundedMin = Math.floor(+minutes / 15) * 15;
      return `${hours}:${roundedMin || '00'}`;
    }
    return formatted;
  }

  clearDate(event: Event) {
    event.stopPropagation();
    event.preventDefault();

    this.dateRange.reset();
  }

  ngOnDestroy(): void {
    this.dateSubscription.unsubscribe();
  }

}
