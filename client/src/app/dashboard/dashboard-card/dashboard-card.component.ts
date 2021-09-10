import { Component, OnInit, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { SubscriptionDetailAllocation } from '@aitheon/billing-manager';
import { getNameFromItemType } from '@aitheon/billing-client';
import * as moment from 'moment';

@Component({
  selector: 'ai-dashboard-card',
  templateUrl: './dashboard-card.component.html',
  styleUrls: ['./dashboard-card.component.scss']
})
export class DashboardCardComponent implements OnInit, OnChanges {
  @Input() service: any;
  @Output() manageServiceEvent: EventEmitter<any> = new EventEmitter();
  allocations: SubscriptionDetailAllocation[];
  nextPaymentDate: Date;

  constructor() {

  }

  ngOnInit(): void {
    this.allocations = this.service.billing.allocations.map((a: SubscriptionDetailAllocation) => {
      a.name = a.name || getNameFromItemType(a.itemType);
      return a;
    });
    this.nextPaymentDate = moment().startOf('month').add(1, 'month').toDate();
  }

  ngOnChanges() {
    this.allocations = this.service.billing.allocations;
  }

  manageService(service: any) {
    this.manageServiceEvent.emit(service);
  }

  getAllocationIcon(allocationType: string) {
    let iconClass;

    switch (allocationType) {
      case 'USER':
        iconClass = 'card__detail__icon--user';
        break;
      case 'DEVICE':
        iconClass = 'card__detail__icon--device';
        break;
      case 'STORAGE':
        iconClass = 'card__detail__icon--storage';
        break;
      case 'TAG':
        iconClass = 'card__detail__icon--tag';
        break;
      case 'ROBOT':
        iconClass = 'card__detail__icon--robot';
        break;
      case 'STATION':
        iconClass = 'card__detail__icon--station';
        break;
    }

    return iconClass;
  }
}
