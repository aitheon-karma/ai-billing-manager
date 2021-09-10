import { NgModule } from '@angular/core';

import { DashboardRoutingModule } from './dashboard-routing.module';
import { DashboardComponent } from './dashboard.component';
import { CoreClientModule } from '@aitheon/core-client';
import { DashboardCardComponent } from './dashboard-card/dashboard-card.component';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { SharedModule } from '../shared/shared.module';
import { NgSelectModule } from '@ng-select/ng-select';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
@NgModule({
  imports: [
    CoreClientModule,
    DashboardRoutingModule,
    NgxChartsModule,
    SharedModule,
    NgSelectModule
  ],
  declarations: [
    DashboardComponent,
    DashboardCardComponent
  ]
})
export class DashboardModule { }
