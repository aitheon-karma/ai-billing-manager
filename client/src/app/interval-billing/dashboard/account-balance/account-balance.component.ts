import { Component, OnInit, TemplateRef, ViewChild } from '@angular/core';

import { TreasuryRestService } from '@aitheon/billing-manager';
import { AccountsRestService } from '@aitheon/treasury';
import { AuthService } from '@aitheon/core-client';
import { ModalDirective } from 'ngx-bootstrap/modal';
import { Observable, of } from 'rxjs';
import { first } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'ai-account-balance',
  templateUrl: './account-balance.component.html',
  styleUrls: ['./account-balance.component.scss']
})
export class AccountBalanceComponent implements OnInit {

  @ViewChild('buyACUModal') buyACUModal: ModalDirective;
  success = false;
  error = false;
  loading = true;

  balance: {total: number, available: number, internal: number, locked: number};
  orgMode = false;
  trialBalance: number;
  fiatAccountEnabled = false;

  constructor(private treasuryRestService: TreasuryRestService,
      private accountsRestService: AccountsRestService,
      private toastr: ToastrService,
       private authService: AuthService) { }

  async ngOnInit() {
    this.loadBalances();
  }

  async loadBalances() {
    let org: any, user: any;
    this.loading = true;
    try {
      // TODO: REMOVE ASYNC
      org = await this.authService.activeOrganization.pipe(first()).toPromise();
      user = await this.authService.currentUser.pipe(first()).toPromise();
    } catch (e) {
      org = user = null;
    }
    let request$: Observable<any>;
    if (org && user) {
      this.orgMode = true;
      request$ = org.createdBy === user._id ? this.accountsRestService.organizationTrialBalance() : of({balance: 0});
    } else {
      request$ = this.accountsRestService.userTrialBalance();
    }
    request$.subscribe(result => {
      this.trialBalance = result.balance;
    }, err => {
        this.trialBalance = 0;
    });

    this.treasuryRestService.acuBalance('response')
    .subscribe(results => {
      if (results.headers.get('X-Fiat-Status') !== 'disabled' ) {
        this.fiatAccountEnabled = true;
      }
      this.balance = results.body;
      this.loading = false;
    });
  }

  openBuyACUModal() {

    if (!this.fiatAccountEnabled) {
      return this.toastr.info('Not allowed at the moment');
    }

    this.buyACUModal.show();
  }


  onSuccess() {
    this.success = true;
  }

  onError() {
    this.error = true;
  }

  get totalBalance() {
    return this.balance.total + (this.trialBalance || 0);
  }
}
