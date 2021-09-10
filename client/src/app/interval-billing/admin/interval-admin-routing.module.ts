import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { SettingsComponent } from './settings.component';
import { DiscountFormComponent } from './discount-form/discount-form.component';

const routes: Routes = [
  {
    path: '', component: SettingsComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class IntervalAdminSettingsRoutingModule { }
