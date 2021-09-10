import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { AdminRestService, TreasuryRestService } from '@aitheon/billing-manager';
import { Transaction } from '@aitheon/treasury';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { IntervalSharedService } from '../../../shared/interval-shared.service';

import { get, sortBy, isEmpty } from 'lodash';
import * as shape from 'd3-shape';
import * as moment from 'moment';

@Component({
  selector: 'ai-usages-by-service',
  templateUrl: './usages-by-service.component.html',
  styleUrls: ['./usages-by-service.component.scss']
})
export class UsagesByServiceComponent implements OnInit, OnDestroy {

  @Input() transactions: Transaction[];

  activeButton = 'today';
  dateRange: FormControl;
  dateSubscription: Subscription;
  usagesSubscription: Subscription;

  bsValue: any;
  maxDate: any;

  view: any[] = [1140, 300];
  showXAxis = true;
  curve: any = shape.curveMonotoneX;
  showYAxis = true;
  gradient = true;
  showLegend = true;
  showXAxisLabel = false;
  showYAxisLabel = false;
  showLabels = false;
  xAxisLabel = '';
  yAxisLabel = '';
  yAxisTickFormattingFn = this.yAxisTickFormatting;
  readonly currentDate = new Date();
  loading = true;
  exchangeRate: {
    createdAt: string,
    destination: string,
    destinationPrice: number,
    source: string,
    sourcePrice: number,
    updatedAt: string,
    __v: number,
    _id: string,
  };

  colorScheme = {
    domain: [
      '#dcbc65',
      '#58508d',
      '#e96058',
      '#67b231',
      '#ff6600',
      '#ef33f2',
      '#8b0707',
      '#0099c6',
      '#a85700',
      '#0c5922',
      '#651067',
      '#aea6b6',
      '#dcca28',
      '#3b3eac',
    ],
  };

  lineChartSeries: any = [];
  lineChartScheme = {
    domain: ['#dcbc65', '#58508d', ]
  };
  options: any = [];

  constructor(
    private adminRestService: AdminRestService,
    private treasuryService: TreasuryRestService,
    private sharedService: IntervalSharedService,
  ) {}

  ngOnInit() {
    this.dateRange = new FormControl(null, Validators.required);
    this.usagesSubscription = forkJoin([
      this.treasuryService.currentExchangeRate().pipe(catchError(() => of({}))),
      this.getStatisticsByService(new Date(), new Date()),
    ]).subscribe(([exchangeRate, statistics]) => {
      this.exchangeRate = exchangeRate;
      this.options = this.groupStatisticsByDate(statistics.paidStats, 'HH:mm');
      const trialSeries = this.getTrialSeries(statistics.trialStats, 'HH:mm');
      this.lineChartSeries.push(trialSeries);
      this.loading = false;
    });
    this.onDateRangeChanges();
  }

  onDateRangeChanges() {
    this.dateSubscription = this.dateRange.valueChanges
      .subscribe(() => {
        if (this.dateRange.valid) {
          this.activeButton = null;
        }
        this.setOptions();
      });
  }

  getStatisticsByService(fromDate: Date, toDate: Date) {
    const isoFromDate = moment(fromDate).startOf('day').toISOString();
    const isoToDate = moment(toDate).endOf('day').toISOString();
    return this.adminRestService.statisticsByService(isoFromDate, isoToDate);
  }

  groupStatisticsByDate(statistics: any, range: string) {
    const services = [];
    const optionsObj = statistics
      .reduce((result, { usages }) => [...result, ...usages], [])
      .reduce((result, usage) => {
        const { requestTime, service, billing = {} } = usage;
        const dateKey = this.getDateKey(requestTime, range);
        const currentValue = billing.total || 0;
        const currentOption = result[dateKey] || {};
        const currentSeries = currentOption.series || {};
        const serviceName = this.getServiceLabel(service);
        const resultValue = get(currentSeries, `${serviceName}.value`, 0) + currentValue;
        if (!services.includes(serviceName)) {
          services.push(serviceName);
        }

        const value = this.sharedService.roundNumber(resultValue, 2);
        return {
          ...result,
          [dateKey]: {
            name: dateKey,
            date: new Date(requestTime),
            series: {
              ...currentSeries,
              [serviceName]: {
                name: serviceName,
                tooltip: this.sharedService.roundNumber(value * this.usdRate, 2),
                value: value,
              }
            }
          }
        };
      }, {});
    const options = sortBy(
      this.fillWithBlankValues(optionsObj, range, services),
      'date',
    );
    this.lineChartSeries = [this.getLineSeries(options, 'Paid')];
    return options;
  }

  setOptions() {
    const dateRange = this.dateRange.value;
    // @ts-ignore
    let [from, to] = dateRange || [];
    if (!this.dateRange.valid) {
      to = moment().endOf('day').toDate();
      from = this.getDefaultFromDate();
      if (this.activeButton === null) {
        this.activeButton = 'today';
      }
    }
    this.loading = true;
    this.getStatisticsByService(from, to)
      .subscribe(statistics => {
        const dayDifference = Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
        let dateFormat = 'MMM DD';
        if (dayDifference <= 14 && dayDifference > 0) {
          dateFormat = 'MMM DD';
        }
        if (dayDifference < 1) {
          dateFormat = 'HH:mm';
        }
        if (dayDifference >= 63) {
          dateFormat = 'MMM';
        }
        if (dayDifference >= 15 && dayDifference <= 62) {
          this.options = this.setWeekOptions(statistics.paidStats);
          const trialSeries = this.getWeekTrialSeries(statistics.trialStats);
          this.lineChartSeries.push(trialSeries);
          this.loading = false;
          return;
        }
        this.options = this.groupStatisticsByDate(statistics.paidStats, dateFormat);
        const trialSeries = this.getTrialSeries(statistics.trialStats, dateFormat);
        this.lineChartSeries.push(trialSeries);
        this.loading = false;
      });
  }

  getDefaultFromDate() {
    let from = moment().startOf('day').toDate();
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

  setWeekOptions(collection: any) {
    const weekMatrix = this.getWeekMatrix();
    const services = [];
    const statistics = weekMatrix.reduce((result, current) => {
      const [fromDate, to] = current;
      const toDate = moment(to).subtract(1, 'd').toDate();
      const dateKey = `${moment(fromDate).format('MMM DD')} - ${moment(toDate).format('MMM DD')}`;
      const currentWeek = collection
        .reduce((records, { usages }) => [...records, ...usages], [])
        .filter(({ requestTime }) => this.checkDate(new Date(requestTime), [fromDate, toDate]))
        .reduce((options, option) => {
          const { service, billing = {} } = option;
          const currentValue = billing.total || 0;
          const currentSeries = options.series || {};
          const serviceName = this.getServiceLabel(service);
          const resultValue = get(currentSeries, `${serviceName}.value`, 0) + currentValue;
          if (!services.includes(serviceName)) {
            services.push(serviceName);
          }
          const value = this.sharedService.roundNumber(resultValue, 2);
          return {
            name: dateKey,
            series: {
              ...currentSeries,
              [serviceName]: {
                name: serviceName,
                tooltip: this.sharedService.roundNumber(value * this.usdRate, 2),
                value,
              },
            },
          };
        }, {});
      if (Object.keys(currentWeek).length) {
        return [
          ...result,
          currentWeek,
        ];
      }
      return result;
    }, []);
    const results = this.fillWithBlankValues(statistics, 'week', services, weekMatrix);

    this.lineChartSeries = [this.getLineSeries(results, 'Paid')];
    return results;
  }

  getWeekMatrix(): any {
    const weekMatrix = [];
    let toDate = new Date();
    if (this.dateRange.valid) {
      const { dateRange } = this.dateRange.value;
      toDate = dateRange[1];
    }
    const prevDate = moment(toDate).subtract(1, 'months');
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

  getWeekTrialSeries(trialStats: any) {
    const usages = trialStats.reduce((result, { usages: currentUsages }) => [...result, ...currentUsages], []);
    const trialSeries = [];
    const weekMatrix = this.getWeekMatrix();
    for (const dateRange of weekMatrix) {
      const [fromDate, to] = dateRange;
      const toDate = moment(to).subtract(1, 'd').toDate();
      const value = usages.reduce((resultValue, usage) => {
        if (this.checkDate(new Date(usage.requestTime), [fromDate, toDate])) {
          return resultValue + usage.billing.total;
        }
        return resultValue;
      }, 0);
      if (value) {
        const dateKey = `${moment(fromDate).format('MMM DD')} - ${moment(toDate).format('MMM DD')}`;
        trialSeries.push({
          name: dateKey,
          value: this.sharedService.roundNumber(value, 2),
        });
      }
    }
    return {
      name: 'Trial',
      series: this.fillWithBlankValues(trialSeries, 'week', null, weekMatrix),
    };
  }

  getTrialSeries(trialStatistics: any, format: string) {
    const trialOptionsObj = trialStatistics
      .reduce((result, current) => [...result, ...current.usages], [])
      .reduce((options, usage) => {
        const { requestTime } = usage;
        const { total } = usage.billing;
        const dateKey = this.getDateKey(requestTime, format);
        const currentOptionValue = get(options, `${dateKey}.value`, 0);
        return {
          ...options,
          [dateKey]: {
            name: dateKey,
            value: this.sharedService.roundNumber(currentOptionValue + total, 2),
          }
        };
      }, {});
    return {
      name: 'Trial',
      series: this.fillWithBlankValues(trialOptionsObj, format),
    };
  }

  getLineSeries(options: any, name: string) {
    return {
      name,
      series: options.map(option => {
        const value = this.sharedService
          .roundNumber(
            option.series.reduce((a, b) => a + b.value, 0),
            2,
          );
        return {
          name: option.name,
          value,
          tooltip: this.sharedService.roundNumber(value * this.usdRate, 2),
        };
      }),
    };
  }

  fillWithBlankValues(collection: any, range: string, services?: any, weekMatrix?: any) {
    if (isEmpty(collection)) {
      return collection;
    }
    const dateRange = this.dateRange.value;
    let filledCollection = [];
    if (range === 'week') {
      filledCollection = this.fillWeeks(weekMatrix, collection, services);
    } else {
      const startDate = this.getStartDate();
      const datesMatrix = this.getDatesMatrix(startDate, range);
      filledCollection = datesMatrix.map(date => {
        const option = collection[date] || {};
        if (services) {
          const series = option.series || {};
          return {
            name: date,
            series: {
              ...this.getDummyServicesSeries(services),
              ...series,
            },
          };
        } else {
          return {
            name: date,
            value: option.value || 0,
            tooltip: this.sharedService.roundNumber((option.value || 0) * this.usdRate, 2),
          };
        }
      });
    }
    return filledCollection
      .filter(({ date }) => {
        if (this.dateRange.valid && date) {
          return this.checkDate(date, dateRange);
        }
        return true;
      })
      .map(({ series, ...restOption }) => ({
        ...restOption,
        series: series ? Object.values(series) : null,
      }));
  }

  fillWeeks(weekMatrix: any, collection: any, services: any) {
    return weekMatrix.map((item, i) => {
      const [fromDate, to] = item;
      const toDate = moment(to).subtract(1, 'd');
      const dateKey = `${moment(fromDate)
        .format('MMM DD')} - ${moment(toDate)
        .format('MMM DD')}`;
      const option = collection.find(({ name }) => name === dateKey) || {};
      if (services) {
        const series = option.series || {};
        return {
          name: dateKey,
          date: i === 3 ? fromDate : toDate.toDate(),
          series: {
            ...this.getDummyServicesSeries(services),
            ...series,
          },
        };
      } else {
        return {
          name: dateKey,
          date: i === 3 ? fromDate : toDate.toDate(),
          value: option.value || 0,
          tooltip: this.sharedService.roundNumber((option.value || 0) * this.usdRate, 2)
        };
      }
    });
  }

  getStartDate() {
    if (this.dateRange.valid) {
      return this.dateRange.value[0];
    } else {
      return this.getDefaultFromDate();
    }
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

  getServiceLabel(serviceName: string) {
    return serviceName.split('_')
      .map(word => {
        if (word === 'HR' || word === 'OMS') {
          return word;
        }
        return `${word.slice(0, 1) + word.slice(1).toLowerCase()}`;
      }).join(' ');
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

  yAxisTickFormatting(val) {
    return `${val} ACU`;
  }

  onChangeDateRange(dateRange: string, event: Event) {
    event.stopPropagation();
    event.preventDefault();

    this.activeButton = dateRange;
    this.dateRange.reset();
  }

  clearDate(event: Event) {
    event.stopPropagation();
    event.preventDefault();

    this.dateRange.reset();
  }

  get usdRate() {
    if (this.exchangeRate) {
      return this.exchangeRate.destinationPrice || 0;
    }
    return 0;
  }

  ngOnDestroy(): void {
    this.dateSubscription.unsubscribe();
    this.usagesSubscription.unsubscribe();
  }

}
