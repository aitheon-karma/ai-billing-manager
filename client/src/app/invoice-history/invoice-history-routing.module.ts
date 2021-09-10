import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { InvoiceHistoryDashboardComponent } from "./invoice-history-dashboard/invoice-history-dashboard.component";

const routes: Routes = [
  {
    path: '', component: InvoiceHistoryDashboardComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class InvoiceHistoryRoutingModule { }
