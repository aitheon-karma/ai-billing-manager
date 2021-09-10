import { Component, OnInit, OnDestroy } from '@angular/core';
import { BillingStatusService, CurrentBillingStatus } from '../../shared/services/billing-status.service';
import { Subscription as RxJsSubscription } from "rxjs/internal/Subscription";
import { PaymentHistoryRestService, PaymentHistory } from "@aitheon/billing-manager";

@Component({
  selector: 'ai-invoice-history-dashboard',
  templateUrl: './invoice-history-dashboard.component.html',
  styleUrls: ['./invoice-history-dashboard.component.scss']
})
export class InvoiceHistoryDashboardComponent implements OnInit, OnDestroy {
  invoicesList: PaymentHistory[];
  selectedFilter = 'All Invoices';
  isFilterOpen = false;
  invoicesListCopy: PaymentHistory[];
  status: CurrentBillingStatus;
  subscriptions = new RxJsSubscription();

  constructor(private billingStatusService: BillingStatusService, private paymentHistoryService: PaymentHistoryRestService) { }

  ngOnInit(): void {
    this.subscriptions.add(this.paymentHistoryService.getOrgHistory().subscribe((historyList: PaymentHistory[]) => {
      this.prettifyInvoiceList(historyList);
      this.sortByDate();
      this.invoicesListCopy = this.invoicesList;
    }));

    this.subscriptions.add(this.billingStatusService.getCurrentUser().subscribe(res => {
      this.status = res;
    }));
  }

  selectFilter(type: string) {
    this.invoicesList = this.invoicesListCopy;
    switch (type) {
      case 'all':
        this.selectedFilter = 'All Invoices';
        break;
      case 'monthly':
        this.selectedFilter = 'Monthly Payments';
        this.invoicesList = this.invoicesListCopy.filter(invoice => invoice.createdBy.kind === 'WORKER');
        break;
      case 'other':
        this.selectedFilter = 'Other Payments';
        break;
      case 'oneTime':
        this.selectedFilter = 'One-time Payments';
        this.invoicesList = this.invoicesListCopy.filter(invoice => invoice.createdBy.kind === 'USER');
        break;
      default:
        this.selectedFilter = 'All Invoices';
        break;
    }
    this.isFilterOpen = false;
  }

  trackBy(index, item): string {
    return item.name;
  }

  private sortByDate() {
    this.invoicesList.sort((a,b) => b?.transaction?.createdAt.getTime() - a?.transaction?.createdAt.getTime());
  }

  ifDateHidden(currentInvoice, prevInvoice) {
    return currentInvoice?.transaction?.createdAt === this.invoicesList[0]?.transaction?.createdAt ||
      (prevInvoice?.transaction?.createdAt && (currentInvoice?.transaction?.createdAt.getMonth() !== prevInvoice?.transaction?.createdAt.getMonth()));
  }

  ngOnDestroy() {
    try {
      this.subscriptions.unsubscribe();
    } catch (e) {
      console.error(e)
    }
  }

  private prettifyInvoiceList(historyList: PaymentHistory[]) {
    this.invoicesList = historyList.filter(invoice => invoice.transaction !== undefined);
    this.invoicesList.map(i => {
      i.transaction.createdAt = new Date(i.transaction.createdAt);

      return i;
    });
  }
}
