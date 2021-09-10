import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IntervalStatisticsRoutingModule } from './interval-statistics-routing.module';
import { StatisticsComponent } from './statistics.component';
import { UserActivityComponent } from './user-activity/user-activity.component';
import { IntervalSharedModule } from '../shared/interval-shared.module';

@NgModule({
  declarations: [
    StatisticsComponent,
    UserActivityComponent,
  ],
  imports: [
    IntervalSharedModule,
    CommonModule,
    IntervalStatisticsRoutingModule,
  ]
})
export class IntervalStatisticsModule { }
