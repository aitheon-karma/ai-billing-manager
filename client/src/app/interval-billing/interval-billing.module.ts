import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IntervalBillingRoutingModule } from './interval-billing-routing.module';
import { IntervalStatisticsModule } from './statistics/interval-statistics.module';
import { IntervalDashboardModule } from './dashboard/interval-dashboard.module';
import { IntervalAdminSettingsModule } from './admin/interval-admin-settings.module';
import { SelectDropDownModule } from 'ngx-select-dropdown';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    IntervalBillingRoutingModule,
    IntervalStatisticsModule,
    IntervalDashboardModule,
    SelectDropDownModule,
    IntervalAdminSettingsModule
  ]
})
export class IntervalBillingModule { }
