import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InvoiceHistoryRoutingModule } from "./invoice-history-routing.module";
import { InvoiceHistoryDashboardComponent } from './invoice-history-dashboard/invoice-history-dashboard.component';
import { InvoiceHistoryInvoiceComponent } from './invoice-history-invoice/invoice-history-invoice.component';
import { SharedModule } from "../shared/shared.module";


@NgModule({
  declarations: [InvoiceHistoryDashboardComponent, InvoiceHistoryInvoiceComponent],
  imports: [
    CommonModule,
    InvoiceHistoryRoutingModule,
    SharedModule
  ]
})
export class InvoiceHistoryModule { }
