import { Injectable, Inject } from '@angular/core';
import { Subject } from 'rxjs';
import { AuthService, RestService, options } from '@aitheon/core-client';
import { BillingEvents, BILLING_CLIENT_OPTIONS, IBillingClientOptions } from './common';

@Injectable({
  providedIn: 'root'
})
export class BillingClientService {

  userId: string;
  organizationId: string;
  private absUrl = false;
  private baseApi = '';
  constructor(private authService: AuthService,
    private restService: RestService,
    @Inject(BILLING_CLIENT_OPTIONS) private injectOptions: IBillingClientOptions) {
    this.authService.activeOrganization.subscribe(org => this.organizationId = org && org._id);
    this.authService.currentUser.subscribe(user => this.userId = user && user._id);
    if (injectOptions?.service !== 'BILLING_MANAGER') {
      this.absUrl = true;
      this.baseApi = `https://${this.authService.baseHost() || 'dev.aitheon.com'}/billing-manager`;
    }
  }
  private _modalStatus = new Subject<{ open: boolean, options: { service: string, userId: string, organizationId: string } }>();
  private _events = new Subject<{event: BillingEvents; data: any}>();

  get modalStatus() {
    return this._modalStatus.asObservable();
  }


  get events() {
    return this._events.asObservable();
  }

  emitEvent(event: BillingEvents, data: any) {
    this._events.next({event, data});
  }


  openManageServiceModal({ service }) {
    this._modalStatus.next({ open: true, options: { service, userId: this.userId, organizationId: this.organizationId } });
  }

  closeManageServiceModal() {
    this._modalStatus.next({ open: false, options: undefined });
  }

  getSubscriptionInfo(service?: string) {
    return this.restService.fetch(`${this.baseApi}/api/subscriptions/info${service ? `?service=${service}` : ''}`, undefined, this.absUrl);
  }

  updateSubscription(subscription: any) {
    return this.restService.put(`${this.baseApi}/api/subscriptions/service/${subscription.service}`, subscription, this.absUrl);
  }

  listActiveInboundFiatAccounts() {
    return this.restService.fetch(`${this.baseApi}/api/treasury/fiat-accounts/inbound`, undefined, this.absUrl);
  }

  bluesnapClientKey() {
    const url = `https://${this.authService.baseHost() || 'dev.aitheon.com'}/treasury/api/provider/inbound/client-key`;
    return this.restService.fetch(url, undefined, true);
  }

  createFiatInboundAccount(account: any) {
    return this.restService.post(`${this.baseApi}/api/treasury/fiat-accounts/inbound`, account, this.absUrl);
  }
}
