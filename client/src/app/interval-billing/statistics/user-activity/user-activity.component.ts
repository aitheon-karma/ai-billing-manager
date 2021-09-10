import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { BillingUsagesRestService } from '@aitheon/billing-manager';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ModalDirective } from 'ngx-bootstrap/modal';
import { Transaction } from '@aitheon/treasury';
import { Subscription } from 'rxjs';

import { TableColumn } from '../../shared/interfaces/table-column.interface';

import * as moment from 'moment';
import { IntervalSharedService } from '../../shared/interval-shared.service';

@Component({
  selector: 'ai-user-activity',
  templateUrl: './user-activity.component.html',
  styleUrls: ['./user-activity.component.scss']
})
export class UserActivityComponent implements OnInit, OnDestroy {

  @ViewChild('serviceDetailsModal') public serviceDetailsModal: ModalDirective;

  listColumns: TableColumn[] = [
    {
      title: 'Service',
      key: 'label',
      flex: 3,
      disableSort: true,
    },
    {
      title: 'Activity time',
      key: 'totalHours',
      flex: 2,
    },
    {
      title: 'Activity cost',
      key: 'totalCost',
      formatter: this.sharedService.roundNumber,
      flex: 2,
      uom: 'ACU',
    },
    {
      flex: 4,
    },
    {
      flex: 1,
      label: 'details',
      callback: this.showDetails.bind(this),
    },
  ];

  modalColumns: TableColumn[] = [
    { title: 'Date', key: 'date', disableSort: true, flex: 4, },
    { title: 'Activity time', disableSort: true, key: 'activityTime', flex: 5, },
    {
      title: 'Activity cost',
      key: 'activityCost',
      flex: 3,
      formatter: this.sharedService.roundNumber,
      uom: 'ACU',
      disableSort: true,
    },
  ];

  pagination = [15, 25, 50];
  userId: string;
  userName: string;
  activeButton = 'today';
  filterForm: FormGroup;
  dateSubscription: Subscription;
  searchSubscription: Subscription;
  userIdSubscription: Subscription;
  userNameSubscription: Subscription;
  billingSubscription: Subscription;
  userActivityCollection = [];
  filteredByDateActivity = [];
  filteredUsageActivity = [];
  totalTime = 0;
  totalSpend = 0;
  serviceDetails: {
    label: string,
    records: any[],
  };
  loading = true;
  readonly currentDate = new Date;

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
    this.userIdSubscription = this.route.paramMap.subscribe(params => {
      this.userId = params.get('userId');
    });
    this.userNameSubscription = this.route.queryParams.subscribe(params => {
      this.userName = params['userName'];
    });
    this.billingSubscription = this.billingUsagesRestService.usagesByDate()
      .subscribe(transactions => {
          this.loading = false;
          this.setUsageActivityCollection(transactions);
        },
        () => {
          this.loading = false;
        });
    this.initForm();
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
        this.filterUsageActivity();
      });
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

  setUsageActivityCollection(transactions: Transaction[]) {
    if (transactions && transactions.length) {
      const userTransactions = transactions
        .filter(({ from }) => {
          const { user = {} } = from || {};
          return user._id === this.userId;
        })
        .reduce((res, curr: any) => [...res, ...curr.usages], [])
        .reduce((result, usage) => {
          // @ts-ignore
          const { requestTime, usageByTime, service, billing = {} } = usage || {};
          const { total } = billing;
          const currentService = result[service];
          const newRecord = {
            date: new Date(requestTime),
            usageTime: this.getTimeDifference(usageByTime, requestTime),
            cost: total,
          };
          if (currentService) {
            return {
              ...result,
              [service]: {
                ...currentService,
                records: [
                  ...currentService.records,
                  newRecord,
                ],
              },
            };
          }
          return {
            ...result,
            [service]: {
              label: this.getServiceLabel(service),
              serviceName: service,
              records: [newRecord],
            },
          };
        }, {});
      this.userActivityCollection = Object.values(userTransactions);
      this.filterUsageActivity();
    }
  }

  filterUsageActivity() {
    const dateRange = this.dateRangeControl.value;
    const search = this.searchControl.value;
    this.filteredByDateActivity = this.userActivityCollection
      .filter(({ label }) => this.checkSearchValue(label, search))
      .map((service) => {
        return {
          ...service,
          records: service.records.filter(({ date }) => this.checkDate(date, dateRange))
        };
      });
    let totalTime = 0;
    let totalSpend = 0;
    const filteredUsageActivity = this.filteredByDateActivity
      .reduce((result, current) => {
        if (!current.records.length) {
          return result;
        }
        const summedValues = this.sumRecordsValues(current.records);
        totalTime += summedValues.usageTime;
        totalSpend += summedValues.cost;

        return [
          ...result,
          {
            serviceName: current.serviceName,
            label: current.label,
            totalHours: this.sharedService.formatTime(summedValues.usageTime),
            totalCost: summedValues.cost,
          }
        ];
      }, []);
    this.totalTime = totalTime;
    this.totalSpend = totalSpend;
    totalTime = totalSpend = 0;
    this.filteredUsageActivity = filteredUsageActivity;
  }

  sumRecordsValues(records: any[]) {
    return records.reduce((result, record) => {
      const { usageTime, cost } = record;
      return {
        usageTime: result.usageTime + usageTime,
        cost: result.cost + cost,
      };
    }, {
      usageTime: 0,
      cost: 0,
    });
  }

  showDetails(row, event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.serviceDetails = this.groupActivityByDate(row.serviceName);
    this.serviceDetailsModal.show();
  }

  groupActivityByDate(serviceName: string) {
    const service = this.filteredByDateActivity
      .find(serv => serv.serviceName === serviceName);
    const grouped = service.records.reduce((result, record) => {
      const { date, cost, usageTime } = record;
      const dateKey = moment(date).format('MM-DD-YYYY');
      const currentRecord = result[dateKey];
      if (currentRecord) {
        return {
          ...result,
          [dateKey]: {
            ...currentRecord,
            cost: currentRecord.cost + cost,
            usageTime: currentRecord.usageTime + usageTime,
          }
        };
      }
      return {
        ...result,
        [dateKey]: { date, cost, usageTime },
      };
    }, {});
    return {
      label: this.getServiceLabel(serviceName),
      records: Object.values(grouped),
    };
  }

  closeModal(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.serviceDetailsModal.hide();
  }

  getServiceLabel(serviceName: string) {
    try {
      return serviceName.split('_')
        .map(word => {
          if (word === 'HR' || word === 'OMS') {
            return word;
          }
          return `${word.slice(0, 1) + word.slice(1).toLowerCase()}`;
        }).join(' ');
    } catch (e) {
      return '';
    }
  }

  getTimeDifference(from: string, to: string) {
    if (from && to) {
      const fromDate = new Date(from);
      const toDate = new Date(to);
      return Number(fromDate) - Number(toDate);
    }
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

  formatRecordsValues(records: { date: Date, usageTime: number, cost: number }[]) {
    return records.map(({ date, usageTime, cost }) => ({
      date: moment(date).format('DD MMM YYYY'),
      activityCost: cost,
      activityTime: this.sharedService.formatTime(usageTime),
    }));
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

  redirectBack(event: Event) {
    event.stopPropagation();
    event.preventDefault();
    this.router.navigate(['../'], { relativeTo: this.route });
  }

  redirectToUserProfile(event: Event) {
    event.stopPropagation();
    event.preventDefault();

    window.location.href = `/hr/employees/${this.userId}`;
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
    this.dateSubscription.unsubscribe();
    this.searchSubscription.unsubscribe();
    this.userIdSubscription.unsubscribe();
    this.userNameSubscription.unsubscribe();
    this.billingSubscription.unsubscribe();
  }
}
