import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { IntervalAdminSettingsRoutingModule } from './interval-admin-routing.module';
import { GlobalSettingsComponent } from './global-settings/global-settings.component';
import { ServicesSettingsComponent } from './services-settings/services-settings.component';
import { DiscountManagementComponent } from './discount-management/discount-management.component';
import { SettingsComponent } from './settings.component';
import { CoreClientModule } from '@aitheon/core-client';
import { DiscountFormComponent } from './discount-form/discount-form.component';
import { ServiceDetailsComponent } from './service-details/service-details.component';
import { UsagesByDateComponent } from './charts/usages-by-date/usages-by-date.component';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { UsagesByServiceComponent } from './charts/usages-by-service/usages-by-service.component';
import { ComboChartComponent } from './charts/combo-chart/combo-chart.component';
import { TooltipModule } from 'ngx-bootstrap/tooltip';
import { SelectDropDownModule } from 'ngx-select-dropdown';
@NgModule({
  declarations: [
    SettingsComponent,
    GlobalSettingsComponent,
    ServicesSettingsComponent,
    DiscountManagementComponent,
    DiscountFormComponent,
    ServiceDetailsComponent,
    UsagesByDateComponent,
    UsagesByServiceComponent,
    ComboChartComponent
  ],
  imports: [
    CoreClientModule,
    CommonModule,
    SelectDropDownModule,
    TooltipModule,
    IntervalAdminSettingsRoutingModule,
    NgxChartsModule,
  ]
})
export class IntervalAdminSettingsModule { }
