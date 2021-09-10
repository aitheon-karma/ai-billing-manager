import {Component, Input, OnInit} from '@angular/core';
import { PaymentHistory } from "@aitheon/billing-manager";

@Component({
  selector: 'ai-invoice-history-invoice',
  templateUrl: './invoice-history-invoice.component.html',
  styleUrls: ['./invoice-history-invoice.component.scss']
})
export class InvoiceHistoryInvoiceComponent implements OnInit {
  @Input() invoice: PaymentHistory;

  constructor() { }

  servicesList: Array<string>;

  ngOnInit(): void {
    this.getUniqueServices();
  }

  getServicesTooltipInfo(services: string[]) {
    const arr = [];
    services.slice(0, 5).forEach((service: string) => {
      const serviceName = service.replace('_', ' ');
      arr.push(serviceName.toLowerCase());
    });
    return arr.join(', ');
  }

  getCardTypeLogo(cardType: string) {
    let logo;
    switch (cardType) {
      case 'VISA':
        logo = 'invoice__logo--visa'
        break;
      case 'MASTERCARD':
        logo = 'invoice__logo--mastercard'
        break;
      case 'DISCOVER':
        logo = 'invoice__logo--discover'
        break;
      case 'UNIONPAY':
        logo = 'invoice__logo--unionpay'
        break;
      case 'JCB':
        logo = 'invoice__logo--jcb'
        break;
      case 'AMEX':
        logo = 'invoice__logo--american-express'
        break;
    }

    return logo;
  }

  invoiceAction(i: PaymentHistory) {
    if (i.transaction.status === 'SUCCESS') {
      window.open(i.invoice.signedUrl);
    } else {
      console.log('Retry Payment');
    }
  }

  getUniqueServices() {
    const services = this.invoice.charges.map(s => s.service);
    this.servicesList = services.sort().reduce(function(a, b){ if (b != a[0]) a.unshift(b); return a }, [])
  }
}
