import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { StatisticsComponent } from './statistics.component';
import { UserActivityComponent } from './user-activity/user-activity.component';


const routes: Routes = [
  { path: 'users', component: StatisticsComponent },
  { path: 'services/:serviceId', component: StatisticsComponent },
  { path: 'users/:userId', component: UserActivityComponent },
  { path: 'services/:serviceId/:userId', component: UserActivityComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class IntervalStatisticsRoutingModule { }
