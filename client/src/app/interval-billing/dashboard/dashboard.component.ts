import { Component, OnInit, OnDestroy, TemplateRef } from '@angular/core';
import { AuthService } from '@aitheon/core-client';
import { BsModalService, BsModalRef } from 'ngx-bootstrap/modal';
import { Subscription } from 'rxjs';
import { BillingUsagesRestService } from '@aitheon/billing-manager';
import { Transaction } from '@aitheon/treasury';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'ai-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {

  currentOrganization: any;
  currentUser: any;
  buyACUModalRef: BsModalRef;
  billingSubscription: Subscription;
  loading = true;
  transactions: Transaction[];

  constructor(
    public authService: AuthService,
    private modalService: BsModalService,
    private toastrService: ToastrService,
    private billingUsagesRestService: BillingUsagesRestService,
  ) {}

  ngOnInit() {
    const today = new Date().toISOString();
    this.billingSubscription = this.billingUsagesRestService.usagesByDate(today, today)
      .subscribe(transactions => {
          this.transactions = transactions;
          this.loading = false;
        },
        error => {
          this.transactions = [];
          this.loading = false;
          this.toastrService.error(error && error.message || error);
        });
    this.authService.activeOrganization.subscribe((organization: any) => {
      this.currentOrganization = organization;
    });

    this.authService.currentUser.subscribe((user: any) => {
      this.currentUser = user;
    });
    this.initCloseCheck();
  }

  initCloseCheck() {
    window.onunload = () => {
      alert('ok logged');
    };
  }

  openBuyACUModal(buyACUModal: TemplateRef<any>) {
    this.buyACUModalRef = this.modalService.show(buyACUModal,
      Object.assign({}, { class: 'modal-middle' })
    );
  }

  closeBuyACUModal(buyACUModal: TemplateRef<any>) {
    this.buyACUModalRef.hide();
  }

  ngOnDestroy(): void {
    this.billingSubscription.unsubscribe();
  }
}
