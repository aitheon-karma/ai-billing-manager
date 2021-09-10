import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { Transaction } from '@aitheon/treasury';
import { Subscription } from 'rxjs';
import { IntervalSharedService } from '../../shared/interval-shared.service';
import { BillingUsagesRestService } from '@aitheon/billing-manager';

import * as _ from 'lodash';
import * as moment from 'moment';

@Component({
  selector: 'ai-most-used',
  templateUrl: './most-used.component.html',
  styleUrls: ['./most-used.component.scss'],
})
export class MostUsedComponent implements OnInit, OnChanges, OnDestroy {

  @Input() transactions: Transaction[];

  activeButton = 'today';
  dateRange: FormControl;
  dateSubscription: Subscription;

  bsValue: any;
  maxDate: any;

  view: any[] = [1125, 175];
  showXAxis = true;
  showYAxis = true;
  gradient = true;
  showLegend = true;
  showXAxisLabel = false;
  showYAxisLabel = false;
  showLabels = false;
  xAxisLabel = '';
  yAxisLabel = '';
  readonly currentDate = new Date();
  yAxisTickFormattingFn = this.yAxisTickFormatting;
  loading = true;

  colorScheme = {
    domain: [
      '#e96058',
      '#67b231',
      '#3b3eac',
      '#dcca28',
      '#ff6600',
      '#ef33f2',
      '#8b0707',
      '#0099c6',
      '#a85700',
      '#0c5922',
      '#651067',
      '#aea6b6',
    ],
  };
  usageCollection: any;
  options: any = [];

  constructor(
    public sharedService: IntervalSharedService,
    private billingUsagesRestService: BillingUsagesRestService,
  ) {
  }

  ngOnInit() {
    this.dateRange = new FormControl([null, null], Validators.required);
    this.onDateRangeChanges();
  }

  ngOnChanges(changes: SimpleChanges) {
    const transactions = <any>changes.transactions;
    if (transactions && transactions.currentValue) {
      this.setUsageCollection(transactions.currentValue);
      this.loading = false;
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
    this.usageCollection = transactions
      .reduce((usages, transaction: any) => [...usages, ...transaction.usages], [])
      .map(({ requestTime, billing, service }) => ({
        date: new Date(requestTime),
        service: this.getServiceLabel(service),
        value: _.get(billing, 'total', 0),
      }));
    this.setOptions();
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
      });
  }

  setOptions() {
    if (this.dateRange.valid) {
      const dateRange = this.dateRange.value;
      const dayDifference = moment(dateRange[1]).diff(moment(dateRange[0]), 'days');
      if (dayDifference > 0 && dayDifference < 15) {
        return this.getOptionsBy('MMM DD');
      }
      if (dayDifference > 15 && dayDifference < 62) {
        return this.setWeekOptions(dateRange);
      }
      if (dayDifference > 61) {
        return this.getOptionsBy('MMM');
      }
      return this.getOptionsBy('HH:mm');
    }
    if (this.activeButton === 'monthly') {
      return this.getOptionsBy('MMM');
    }
    if (this.activeButton === 'weekly') {
      return this.setWeekOptions();
    }
    if (this.activeButton === 'daily') {
      return this.getOptionsBy('MMM DD');
    }
    this.activeButton = 'today';
    return this.getOptionsBy('HH:mm');
  }

  getOptionsBy(format: string) {
    const services = [];
    const optionsObject = this.usageCollection
      .reduce((result, current) => {
        const { date, service, value } = current;
        const dateKey = this.getDateKey(date, format);
        const prevSeries = _.get(result, `${dateKey}.series`, {});
        const serviceValue = _.get(prevSeries, `${service}.value`, 0);
        if (!services.includes(service)) {
          services.push(service);
        }
        return {
          ...result,
          [dateKey]: {
            name: dateKey,
            date,
            series: {
              ...prevSeries,
              [service]: {
                name: service,
                value: serviceValue + value,
              }
            }
          }
        };
      }, {});
    this.options = this.fillWithBlankValues(optionsObject, services, format);
  }

  filterByDate(dateRange?: Date[], collection?: any) {
    return (collection || this.usageCollection)
      .filter(({ date }) => {
        if (dateRange) {
          const [from, to] = dateRange;
          return this.checkDate(
            date,
            [
              moment(from).startOf('day').toDate(),
              moment(to).endOf('day').toDate(),
            ]);
        }
        return true;
      });
  }

  fillWithBlankValues(collection: any, services, range: string, weekMatrix?: any) {
    if (_.isEmpty(collection)) {
      return collection;
    }
    let filledCollection = [];
    if (range === 'week') {
      filledCollection = this.fillWeeks(weekMatrix, collection, services);
    } else {
      const startDate = this.getStartDate();
      const datesMatrix = this.getDatesMatrix(startDate, range);
      filledCollection = datesMatrix.map(date => {
        const option = collection[date] || {};
        const series = option.series || {};
        return {
          name: date,
          series: {
            ...this.getDummyServicesSeries(services),
            ...series,
          },
        };
      });
    }
    const dateRange = this.dateRange.value;
    return filledCollection
      .filter(({ date }) => {
        if (this.dateRange.valid && date) {
          return this.checkDate(date, dateRange);
        }
        return true;
      })
      .map(({ series, ...restOption }) => ({
        ...restOption,
        series: Object.values(series),
      }));
  }

  setWeekOptions(dateRange?: Date[]) {
    const filteredOptions = this.filterByDate(dateRange);
    this.options = this.getWeekMatrix()
      .reduce((result, current) => {
        const [fromDate, to] = current;
        const toDate = new Date(moment(to).subtract(1, 'd').format());
        const dateKey = `${moment(fromDate).format('MMM DD')} - ${moment(toDate).format('MMM DD')}`;
        const week = this.filterByDate([fromDate, toDate], filteredOptions);
        if (!week.length) {
          return result;
        }
        const weekOptions = week.reduce((options, usage) => {
          const { service, value } = usage;
          const prevSeries = options.series || {};
          const serviceValue = _.get(prevSeries, `${service}.value`, 0);
          return {
            name: dateKey,
            series: {
              ...prevSeries,
              [service]: {
                name: service,
                value: serviceValue + value,
              }
            }
          };
        }, {});

        return [
          ...result,
          {
            ...weekOptions,
            series: Object.values(weekOptions.series).map(({ name, value }) => ({
              name,
              value: this.sharedService.roundNumber(value),
            })),
          }
        ];
      }, []);
  }

  fillWeeks(weekMatrix: any, collection: any, services: any) {
    return weekMatrix.map((item, i) => {
      const [fromDate, to] = item;
      const toDate = moment(to).subtract(1, 'd');
      const dateKey = `${moment(fromDate)
        .format('MMM DD')} - ${moment(toDate)
        .format('MMM DD')}`;
      const option = collection.find(({ name }) => name === dateKey) || {};
      let series = option.series || {};
      series = {
        ...this.getDummyServicesSeries(services),
        ...series,
      };
      return {
        name: dateKey,
        date: i === 3 ? fromDate : toDate.toDate(),
        series,
      };
    });
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

  getDummyServicesSeries(services) {
    const servicesObj = {};
    services.forEach(service => {
      servicesObj[service] = {
        name: service,
        tooltip: 0,
        value: 0,
      };
    });
    return servicesObj;
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

  getStartDate() {
    if (this.dateRange.valid) {
      const [from] = this.dateRange.value;
      return from;
    } else {
      return this.getFromDate();
    }
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

  getServiceLabel(serviceName: string) {
    return serviceName.split('_')
      .map(word => {
        if (word === 'HR' || word === 'OMS') {
          return word;
        }
        return `${word.slice(0, 1) + word.slice(1).toLowerCase()}`;
      }).join(' ');
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

  onChangeDateRange(dateRange: string, event: Event) {
    event.stopPropagation();
    event.preventDefault();

    if (this.dateRange.valid) {
      this.dateRange.reset();
    }
    this.activeButton = dateRange;
    this.updateOptions();
  }

  clearDate(event: Event) {
    event.stopPropagation();
    event.preventDefault();

    this.dateRange.reset();
  }

  yAxisTickFormatting(val) {
    return `${val} ACU`;
  }

  ngOnDestroy(): void {
    this.dateSubscription.unsubscribe();
  }

}
