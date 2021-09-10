import { Component, OnInit, OnDestroy } from '@angular/core';
import { AuthService } from '@aitheon/core-client';
import { BillingClientService, BillingEvents } from '@aitheon/billing-client';
import { SubscriptionDetails, SubscriptionDetailsForService } from '@aitheon/billing-manager';
import { map, filter, first } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';
import { Subscription as RxJsSubscription } from 'rxjs';
import { BillingStatusService, CurrentBillingStatus } from '../shared/services/billing-status.service';

@Component({
  selector: 'ai-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: [
    './dashboard.component.scss',
    './dashboard.component.dark.scss'
  ]
})
export class DashboardComponent implements OnInit, OnDestroy {

  constructor(
    public authService: AuthService,
    private toastr: ToastrService,
    private billingClientService: BillingClientService,
    private billingStatusService: BillingStatusService
  ) { }

  totalFee: number = undefined;
  expandInfo = false;
  chartValues: {name: string, value: number}[];
  subscriptions = new RxJsSubscription();
  status: CurrentBillingStatus;

  servicesInfo: any[] = [];

  ngOnInit() {
    this.getSubscriptions();
    const sub = this.billingClientService.events
      .pipe(filter(res => res.event === BillingEvents.SUBSCRIPTION_UPDATED))
      .subscribe(() => this.getSubscriptions());

    this.subscriptions.add(sub);

    this.subscriptions.add(this.billingStatusService.getCurrentUser().subscribe(res => {
      this.status = res;
    }));
  }


  getSubscriptions() {
    this.billingClientService.getSubscriptionInfo()
    .subscribe(info => this.processSubscriptionInfo(info),
      (err) => this.toastr.error(err.message));
  }

  manageService(service: string) {
    this.billingClientService.openManageServiceModal({ service });
  }

  processSubscriptionInfo(subscriptionInfo: SubscriptionDetails) {
    this.servicesInfo = [];
    this.totalFee = 0;
    for (const key in subscriptionInfo.services) {
      if (typeof subscriptionInfo.services[key] !== 'object' || !subscriptionInfo.services[key]?.billing?.allocations?.length) {
        continue;
      }
      let sum = 0;
      const allocations: SubscriptionDetailsForService[] = subscriptionInfo.services[key].billing.allocations;
      for (const a of allocations) {
        if (typeof a['itemPrice']?.calculatedPrice === 'number') {
          sum += a['itemPrice'].calculatedPrice;
        }
      }
      subscriptionInfo.services[key].totalPrice = sum;
      if (!(!subscriptionInfo.services[key].core && !subscriptionInfo.services[key].enabled)) {
        this.servicesInfo.push(subscriptionInfo.services[key]);
        this.totalFee = this.totalFee + sum;
      }
    }
    this.chartValues = this.servicesInfo.map(s => ({name: s.name, value: s.totalPrice}));
  }



  onSelectPie(event) {

  }

  changePieTooltip(pie: any) {
    return `${pie.data.label}<br/>$${pie.value}`;
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }
}
