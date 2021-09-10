import { Component, OnInit, OnDestroy } from '@angular/core';
import { BillingUsagesRestService } from '@aitheon/billing-manager';
import { ActivatedRoute, Router } from '@angular/router';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import * as moment from 'moment';
import { Transaction } from '@aitheon/treasury';
import { Subscription } from 'rxjs';

import { TableColumn } from '../shared/interfaces/table-column.interface';
import { IntervalSharedModule } from '../shared/interval-shared.module';
import { IntervalSharedService } from '../shared/interval-shared.service';

@Component({
  selector: 'ai-statistics',
  templateUrl: './statistics.component.html',
  styleUrls: ['./statistics.component.scss']
})
export class StatisticsComponent implements OnInit, OnDestroy {

  listColumns: TableColumn[] = [
    {
      title: 'User name',
      key: 'userName',
      flex: 3,
      disableSort: true,
    },
    {
      title: 'Activity time',
      key: 'overallTime',
      flex: 2,
    },
    {
      title: 'Activity cost',
      key: 'overallCost',
      flex: 2,
      formatter: this.sharedService.roundNumber,
      uom: 'ACU',
    },
    {
      flex: 4,
    },
    {
      label: 'info',
      flex: 1,
      callback: this.redirectToUserDetails.bind(this),
    },
  ];

  pagination = [15, 25, 50];
  serviceLabel: string;
  serviceName: string;
  activeButton = 'today';
  filterForm: FormGroup;
  searchSubscription: Subscription;
  dateSubscription: Subscription;
  routeSubscription: Subscription;
  billingSubscription: Subscription;
  usageActivityByService = [];
  filteredUsageActivity = [];
  totalTime = 0;
  totalSpend = 0;
  loading = true;
  readonly currentDate = new Date();

  constructor(
    private billingUsagesRestService: BillingUsagesRestService,
    private sharedService: IntervalSharedService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  get dateRangeControl() {
    return this.filterForm.get('dateRange') as FormControl;
  }

  get searchControl() {
    return this.filterForm.get('search') as FormControl;
  }

  ngOnInit() {
    this.routeSubscription = this.route.paramMap.subscribe(params => this.checkAndSetServiceName(params.get('serviceId')));
    this.billingSubscription = this.billingUsagesRestService.usagesByDate()
      .subscribe(transactions => {
          this.setUsageActivityCollection(transactions);
          this.loading = false;
        },
        () => {
          this.loading = false;
        });
    this.initForm();
  }

  checkAndSetServiceName(serviceName: string) {
    if (serviceName) {
      this.serviceName = serviceName.toUpperCase();
      this.serviceLabel = this.getServiceLabel(this.serviceName);
    }
  }

  updateOptions() {
    this.loading = true;
    let fromDate;
    let toDate = new Date().toISOString();
    if (this.dateRangeControl.valid) {
      fromDate = moment(this.dateRangeControl.value[0]).add(12, 'h').toISOString();
      toDate = moment(this.dateRangeControl.value[1]).add(12, 'h').toISOString();
    } else {
      fromDate = this.getFromDate(true).toISOString();
    }
    this.billingUsagesRestService.usagesByDate(fromDate, toDate)
      .subscribe(transactions => {
        this.setUsageActivityCollection(transactions);
        this.loading = false;
      });
  }

  initForm() {
    this.filterForm = new FormGroup({
      dateRange: new FormControl(null, Validators.required),
      search: new FormControl(null),
    });
    this.onDateRangeChanges();
    this.onSearchChanges();
  }

  onDateRangeChanges() {
    this.dateSubscription = this.dateRangeControl.valueChanges
      .subscribe(() => {
        this.updateOptions();
      });
  }

  onSearchChanges() {
    this.searchSubscription = this.searchControl.valueChanges
      .subscribe(() => {
        this.setUsageActivity();
      });
  }

  setUsageActivityCollection(transactions: Transaction[]) {
    if (transactions && transactions.length) {
      const usageActivityByService = transactions.reduce((result, current) => {
        // @ts-ignore
        const filteredUsages = current.usages
          .filter(({ service }) => {
            if (this.serviceName) {
              return this.serviceName === service;
            }
            return true;
          });
        if (filteredUsages.length) {
          return [
            ...result,
            {
              ...current,
              usages: filteredUsages,
            },
          ];
        }
        return result;
      }, []).reduce((result, transaction) => {
        // @ts-ignore
        const { from, usages } = transaction;
        const { user = {} } = from || {};
        const { profile = {}, _id } = user;

        const userRecords = usages
          .map(usage => {
            // @ts-ignore
            const { billing = {}, requestTime, usageByTime } = usage || {};
            return {
              date: new Date(requestTime),
              usageTime: this.getTimeDifference(usageByTime, requestTime),
              cost: billing.total,
            };
          });
        const currentUser = result[_id] || {};
        const currentUserRecords = currentUser.records || [];
        return {
          ...result,
          [_id]: {
            userId: _id,
            userName: `${profile.firstName} ${profile.lastName}`,
            records: [...currentUserRecords, ...userRecords],
          },
        };
      }, []);
      this.usageActivityByService = Object.values(usageActivityByService);
      this.setUsageActivity();
    }
  }

  setUsageActivity() {
    const usageActivityCollection = [];
    this.usageActivityByService.forEach((user) => {
      const { records, userName, userId } = user;
      const dateRange = this.dateRangeControl.value;
      const search = this.searchControl.value;
      if (this.checkSearchValue(userName, search)) {
        const userActivityItem = records.reduce((result, current) => {
          const resultTime = (result.overallTime || 0) + current.usageTime;
          const resultSpend = (result.overallCost || 0) + current.cost;
          if (this.checkDate(current.date, dateRange)) {
            return {
              id: userId,
              userName,
              overallTime: resultTime,
              overallCost: resultSpend,
            };
          }
          return result;
        }, {});
        if (Object.keys(userActivityItem).length) {
          usageActivityCollection.push(userActivityItem);
        }
      }
    });

    let totalTime = 0;
    let totalSpend = 0;
    const resultCollection = usageActivityCollection.map(user => {
      totalTime += user.overallTime;
      totalSpend += user.overallCost;
      return {
        ...user,
        overallTime: this.sharedService.formatTime(user.overallTime),
      };
    });
    this.totalSpend = totalSpend;
    this.totalTime = totalTime;
    totalTime = totalSpend = 0;
    this.filteredUsageActivity = resultCollection;
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

  getTimeDifference(from: string, to: string) {
    if (from && to) {
      const fromDate = new Date(from);
      const toDate = new Date(to);
      return Number(fromDate) - Number(toDate);
    }
  }

  get title() {
    if (!this.serviceName) {
      return 'User Statistics';
    }
    return `${this.serviceLabel} Usage Activity`;
  }

  checkSearchValue(serviceName, searchValue) {
    if (searchValue) {
      return serviceName
        .toLowerCase()
        .includes(searchValue.toLowerCase());
    }
    return true;
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
      this.filterForm.get('dateRange').setValue([new Date(), new Date()]);
    }
    if (dateRange === 'week') {
      const prevDate = moment().subtract(7, 'd').format();
      this.filterForm.get('dateRange').setValue([new Date(prevDate), new Date()]);
    }
    if (dateRange === 'month') {
      const prevDate = moment().subtract(1, 'months').format();
      this.filterForm.get('dateRange').setValue([new Date(prevDate), new Date()]);
    }
  }

  redirectToUserDetails(rowData: any, event: Event) {
    event.stopPropagation();
    event.preventDefault();

    const { userName, id } = rowData;

    this.router.navigate(
      [id],
      {
        relativeTo: this.route,
        queryParams: { userName },
      },
    );
  }

  clearActiveButton(event: Event) {
    event.stopPropagation();
    event.preventDefault();

    this.activeButton = null;
  }

  clearFormControl(control: string, event?: Event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    if (control === 'dateRange') {
      this.activeButton = 'today';
      this.filterForm.get(control).setValue(null);
    } else {
      this.filterForm.get(control).setValue('');
    }
  }

  ngOnDestroy(): void {
    this.routeSubscription.unsubscribe();
    this.billingSubscription.unsubscribe();
    this.dateSubscription.unsubscribe();
    this.searchSubscription.unsubscribe();
  }
}
