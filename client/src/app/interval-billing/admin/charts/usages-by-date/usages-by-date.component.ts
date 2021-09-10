import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';

import * as shape from 'd3-shape';
import * as moment from 'moment';
import * as _ from 'lodash';
import { AdminRestService } from '@aitheon/billing-manager';
import { IntervalSharedService } from '../../../shared/interval-shared.service';

@Component({
  selector: 'ai-usages-by-date',
  templateUrl: './usages-by-date.component.html',
  styleUrls: ['./usages-by-date.component.scss']
})
export class UsagesByDateComponent implements OnInit, OnDestroy {

  activeButton = 'today';
  filterForm: FormGroup;
  formSubscription: Subscription;
  usagesSubscription: Subscription;

  bsValue: any;
  maxDate: any;
  view: any[] = [840, 220];
  showXAxis = true;
  showYAxis = true;
  gradient = false;
  showLegend = false;
  showXAxisLabel = false;
  showYAxisLabel = false;
  yAxisLabel = 'Total';
  roundDomains = true;
  yAxisTickFormattingFn = this.yAxisTickFormatting.bind(this);
  xAxisTickFormattingFn = this.xAxisTickFormatting.bind(this);
  curve: any = shape.curveMonotoneX;
  servicesUsage = [];
  loading = true;
  dayStatistics: any;
  readonly currentDate = new Date();
  colorScheme = {
    domain: ['#dcbc65']
  };
  options: any = [
    {
      'name': 'Total',
      'series': [],
    },
  ];

  constructor(
    private adminRestService: AdminRestService,
    private sharedService: IntervalSharedService,
  ) {}

  ngOnInit(): void {
    this.filterForm = new FormGroup({
      dateRange: new FormControl([null, null], Validators.required),
    });
    this.usagesSubscription = this.getStatisticsByDate(new Date(), new Date())
      .subscribe((statistics: { requestTime: string, total: number }[]) => {
        this.dayStatistics = statistics;
        this.setDaySeries(statistics);
      });
    this.onFormChanges();
  }

  setDaySeries(statistics) {
    this.options = [{
      'name': 'Total',
      'series': this.formatStatistics(statistics),
    }];
    this.loading = false;
  }

  formatStatistics(statistics) {
    return statistics.map(({ requestTime, total }) => ({
      value: this.sharedService.roundNumber(total || 0),
      name: moment(requestTime).format('HH:mm'),
      date: new Date(requestTime),
    }));
  }

  getStatisticsByDate(fromDate: Date, toDate: Date) {
    return this.adminRestService.statisticsByDate(fromDate.toISOString(), toDate.toISOString());
  }

  onFormChanges() {
    this.formSubscription = this.filterForm.valueChanges
      .subscribe(() => {
        if (!this.filterForm.valid) {
          this.activeButton = 'today';
        } else {
          this.activeButton = null;
        }
        this.getSeries();
      });
  }

  getSeries() {
    this.loading = true;
    if (this.filterForm.valid) {
      const { dateRange } = this.filterForm.value;
      const dayDifference = (dateRange[1].getTime() - dateRange[0].getTime()) / (1000 * 60 * 60 * 24);
      if (dayDifference < 15 && dayDifference >= 1) {
        this.getSeriesByDate('MMM DD');
      }
      if (dayDifference < 1) {
        this.getSeriesByDate('HH:mm');
      }
      if (dayDifference > 14 && dayDifference < 60) {
        this.getSeriesByDate('week');
      }
      if (dayDifference > 60) {
        this.getSeriesByDate('MMM');
      }
      return;
    }
    if (this.activeButton === 'monthly') {
      this.getSeriesByDate('MMM');
    }
    if (this.activeButton === 'weekly') {
      this.getSeriesByDate('week');
    }
    if (this.activeButton === 'daily') {
      this.getSeriesByDate('MMM DD');
    }
    if (this.activeButton === 'today') {
      this.setDaySeries(this.dayStatistics);
    }
  }

  getWeekOptions(statistics) {
    return this.getWeekMatrix().reduce((result, dateRange) => {
      const [fromDate, to] = dateRange;
      const toDate = new Date(moment(to).subtract(1, 'd').format());
      const dateKey = `${moment(fromDate).format('MMM DD')} -- ${moment(toDate).format('MMM DD')}`;
      const value = statistics
        .filter(({requestTime}) => this.checkDate(moment(requestTime).toDate(), dateRange))
        .reduce((a, b) => a + b.total, 0);
      if (value) {
        return [
          ...result,
          {
            name: dateKey,
            value,
          },
        ];
      }
      return result;
    }, []);
  }

  getSeriesByDate(range) {
    // @ts-ignore
    let [from, to] = this.filterForm.get('dateRange').value || [];
    if (!this.filterForm.valid) {
      to = new Date();
      if (range === 'MMM') {
        from = moment().subtract(6, 'months').toDate();
      }
      if (range === 'week') {
        from = moment().subtract(2, 'months').toDate();
      }
      if (range === 'MMM DD') {
        from = moment().subtract(14, 'd').toDate();
      }
    }
    return this.getStatisticsByDate(from, to)
      .subscribe(statistics => {
        this.loading = false;
        this.options = [{
          name: 'Total',
          series: this.groupStatisticsBy(statistics, range),
        }];
      });
  }

  groupStatisticsBy(statistics, range) {
    let grouped = [];
    if (range !== 'week') {
      grouped = statistics.reduce((result, { requestTime, total }) => {
        const dateKey = this.getDateKey(requestTime, range);
        const currentValue = _.get(result, `${dateKey}.value`, 0);
        return {
          ...result,
          [dateKey]: {
            date: new Date(requestTime),
            name: dateKey,
            value: this.sharedService.roundNumber(total + currentValue, 3),
          },
        };
      }, {});
    } else {
      grouped = this.getWeekOptions(statistics);
    }
    return _.sortBy(Object.values(grouped), 'date');
  }

  onChangeDateRange(dateRange: string, event: Event) {
    event.stopPropagation();
    event.preventDefault();

    this.activeButton = dateRange;
    this.getSeries();
  }

  yAxisTickFormatting (val) {
    return `${val} ACU`;
  }

  xAxisTickFormatting (val) {
    return val.replace('-', ' ');
  }

  getWeekMatrix(): any {
    const weekMatrix = [];
    const prevDate = moment().subtract(1, 'months');
    let day = moment(
      prevDate.endOf('week'))
      .add(1, 'd');
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
    } while (Number(new Date(day.format())) < Number(new Date()));
    return weekMatrix;
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
    this.loading = true;

    this.filterForm.reset();
  }

  ngOnDestroy(): void {
    this.formSubscription.unsubscribe();
  }

}
