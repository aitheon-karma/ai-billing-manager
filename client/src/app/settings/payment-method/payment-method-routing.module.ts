import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { PaymentMethodDashboardComponent } from "./payment-method-dashboard/payment-method-dashboard.component";

const routes: Routes = [
  {
    path: '', component: PaymentMethodDashboardComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PaymentMethodRoutingModule { }
