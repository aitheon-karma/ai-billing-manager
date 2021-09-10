import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { SysAdminGuardService } from '../core/guards/sysadmin-guard.service';

const routes: Routes = [
  { path: '', redirectTo: '/interval/dashboard', pathMatch: 'full' },
  { path: 'statistics', loadChildren: () => import('./statistics/interval-statistics.module').then(m => m.IntervalStatisticsModule),
   canActivate: [SysAdminGuardService] },
  { path: 'admin', loadChildren: () => import('./admin/interval-admin-settings.module').then(m => m.IntervalAdminSettingsModule)},
];

@NgModule({
  imports: [
    RouterModule.forChild(routes),
  ],
  exports: [RouterModule]
})
export class IntervalBillingRoutingModule { }
