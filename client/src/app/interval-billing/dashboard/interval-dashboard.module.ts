import { NgModule } from '@angular/core';

import { IntervalDashboardRoutingModule } from './interval-dashboard-routing.module';
import { DashboardComponent } from './dashboard.component';
import { BuyAcuFormComponent } from './buy-acu-form/buy-acu-form.component';
import { AccountBalanceComponent } from './account-balance/account-balance.component';
import { UsageComponent } from './usage/usage.component';
import { MostUsedComponent } from './most-used/most-used.component';
import { DiscountBonusComponent } from './discount-bonus/discount-bonus.component';
import { DashboardStatisticsComponent } from './dashboard-statistics/dashboard-statistics.component';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { RoundProgressModule } from 'angular-svg-round-progressbar';
import { NgxMaskModule } from 'ngx-mask';
import { DigitOnlyDirective } from '../shared/directives/digits-only.directive';
import { IntervalSharedModule } from '../shared/interval-shared.module';

@NgModule({
  imports: [
    NgxChartsModule,
    RoundProgressModule,
    NgxMaskModule,
    IntervalSharedModule,
    IntervalDashboardRoutingModule
  ],
  declarations: [
    DashboardComponent,
    BuyAcuFormComponent,
    DigitOnlyDirective,
    AccountBalanceComponent,
    UsageComponent,
    MostUsedComponent,
    DiscountBonusComponent,
    DashboardStatisticsComponent,
  ],
})
export class IntervalDashboardModule { }
