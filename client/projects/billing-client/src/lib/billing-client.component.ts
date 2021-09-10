import { Component, OnInit, TemplateRef, OnDestroy, ViewChild, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { BsModalService, BsModalRef } from 'ngx-bootstrap/modal';
import { BillingClientService } from './billing-client.service';
import { Subscription } from 'rxjs';
import { FormGroup, FormBuilder, FormArray, Validators } from '@angular/forms';
import { distinctUntilChanged, debounceTime } from 'rxjs/operators';
import { Allocation, getNameFromItemType, AllocationCalculated, toFixedNumber, PaymentStatus, BillingEvents } from './common';
import { PaymentMethodModalComponent } from './payment-method-modal/payment-method-modal.component';
import { PaymentStatusModalComponent } from './payment-status-modal/payment-status-modal.component';




@Component({
  selector: 'lib-billing-client',
  templateUrl: './billing-client.component.html',
  styleUrls: ['./billing-client.component.scss']
})
export class BillingClientComponent implements OnInit, OnDestroy {


  constructor(private modalService: BsModalService,
    private fb: FormBuilder,
    private cd: ChangeDetectorRef,
    private billingClientService: BillingClientService) { }

  get allocationsArray() {
    return this.subscriptionForm.get('allocations') as FormArray;
  }


  @ViewChild('billingClientTemplate') billingClientTemplate: TemplateRef<any>;
  modalRef: BsModalRef;
  subscriptions: Subscription = new Subscription();
  loading = false;
  monthlyPriceMultiplier = 1;
  options: any = {};
  subscriptionForm: FormGroup;
  allocations: Allocation[];
  @ViewChild(PaymentMethodModalComponent) paymentMethodModal: PaymentMethodModalComponent;
  @ViewChild(PaymentStatusModalComponent) paymentStatusModal: PaymentStatusModalComponent;
  paymentStatus: PaymentStatus;


  totals = {
    oneTime: 0,
    combined: 0
  };
  readonly Math = Math;
  hasChanged: boolean;
  allocationChanges: Array<any> = [];
  userCards = [
    {
      value: '1234',
      name: '**** **** **** 1234'
    },
    {
      value: '3255',
      name: '**** **** **** 3255'
    }
  ];
  accounts: any[] = [];

  savedQuantities: number[] = [];

  buildForm() {
    const groups = this.allocations.map(a =>
      this.fb.group({
        itemReference: [a.itemReference],
        itemType: [a.itemType],
        billingInterval: [a.billingInterval],
        name: [a.name],
        calculated: [],
        quantity: [a.quantity],
        used: [a.used],
      }));
    const defaultAccount = this.accounts && this.accounts.find(a => a.default);
    this.subscriptionForm = this.fb.group({
      allocations: this.fb.array(groups),
      accountId: [defaultAccount ? defaultAccount.value : this.accounts.length ? this.accounts[0].value : null],
      agreeTerms: [false, Validators.requiredTrue]
    });
    this.subscriptions.add(this.allocationsArray
      .valueChanges.pipe(distinctUntilChanged(), debounceTime(20))
      .subscribe(values => this.calculateChanged(values)));
  }

  ngOnInit(): void {
    this.subscriptions.add(this.billingClientService.modalStatus.subscribe(this.handleModalStatus.bind(this)));
    this.billingClientService.listActiveInboundFiatAccounts().subscribe(accounts => {
      this.accounts = accounts.map(a => (
        {
          name: `**** **** **** ${a.inboundProvider?.blueSnap?.cardInfo?.lastFourDigits || a.lastDigits}`,
          value: a._id,
          default: a.defaultSending
        }
      ));
      if (this.subscriptionForm && !this.subscriptionForm.value.accountId) {
        const defaultAccount = this.accounts && this.accounts.find(a => a.default);
        this.subscriptionForm.get('accountId')
          .setValue(defaultAccount ? defaultAccount.value : this.accounts.length ? this.accounts[0].value : null);
      }
    });
  }


  calculateChanged(allocations: any[]) {
    const changes = allocations.filter(a => (a.calculated
      && typeof a.calculated.changedQuantity !== 'undefined'))
      .map(a => {
        const calculated = a.calculated as AllocationCalculated;
        return {
          action: calculated.changedQuantity > 0 ? 'Adding' : 'Removing',
          price: calculated.oneTimePrice,
          oneTimePriceWithModifier: calculated.oneTimePriceWithModifier < 0 ? 0 : calculated.oneTimePriceWithModifier,
          changed: calculated.changedQuantity,
          totalPrice: calculated.totalPrice,
          name: a.name
        };
      });

    this.allocationChanges = changes;
    this.totals.combined = 0;
    this.totals.oneTime = 0;
    this.hasChanged = false;
    for (const change of changes) {
      this.totals.combined = this.totals.combined + change.totalPrice;
      this.totals.oneTime = this.totals.oneTime + change.oneTimePriceWithModifier;
      if (!this.hasChanged && change.changed !== 0) {
        this.hasChanged = true;
      }
    }
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  private handleModalStatus({ open, options }: { open: string, options: any }) {
    if (!open) {
      return this.closeModal();
    }
    this.loading = true;
    this.options = options;
    this.totals = { combined: 0, oneTime: 0 };
    this.subscriptionForm = null;
    this.allocationChanges = [];
    this.savedQuantities = [];
    this.modalRef = this.modalService.show(this.billingClientTemplate, {ignoreBackdropClick: true});
    this.billingClientService.getSubscriptionInfo(this.options.service)
      .subscribe(subscriptions => {
        this.initSubscription(subscriptions);
      });
  }


  initSubscription(subscriptions: any) {
    const allocations = (subscriptions.services[this.options.service]
      && subscriptions.services[this.options.service]?.billing?.allocations) || [];
    this.allocations = allocations.map(a => ({
      itemType: a.itemType,
      name: a.name || getNameFromItemType(a.itemType),
      itemReference: a.itemReference,
      used: a.used || 0,
      billingInterval: a.billingInterval,
      quantity: a.quantity,
      monthlyPriceMultiplier: subscriptions.monthlyPriceMultiplier,
      itemPrice: {
        ranges: a.itemPrice.ranges,
        prices: a.itemPrice.prices
      },
    }));
    this.buildForm();

    if (subscriptions.services[this.options.service]) {
      this.paymentStatus = {serviceName: subscriptions.services[this.options.service].name,
        serviceUrl: subscriptions.services[this.options.service].url  };
    }

    this.loading = false;
  }

  buildPayload() {
    const allocations = this.subscriptionForm.value.allocations
      .filter(a => a.calculated && a.calculated.changedQuantity)
      .map(a => {
        const { calculated, ...rest } = a;
        return { ...rest, ...calculated };
      });
    const subscriptionPayload = {
      service: this.options.service,
      subscriptionTotalPrice: toFixedNumber(this.totals.combined),
      subscriptionTotalPriceUntouched: this.totals.combined,
      updateOneTimeTotalPrice: toFixedNumber(this.totals.oneTime),
      updateOneTimeTotalPriceUntouched: this.totals.oneTime,
      allocations: allocations,
      accountId: this.subscriptionForm.value.accountId
    };
    return subscriptionPayload;
  }


  submit() {
    const subscriptionPayload = this.buildPayload();
    this.paymentStatus.processing = true;
    this.paymentStatus.updateOnly = this.totals.oneTime === 0;
    this.modalRef.hide();
    setTimeout(() => this.paymentStatusModal.open(), 220);
    this.savedQuantities = this.allocationsArray.value.map(a => a.calculated?.changedQuantity);
    this.billingClientService.updateSubscription(subscriptionPayload).subscribe((payload) => {
      this.paymentStatus.success = true;
      this.paymentStatus.error = false;
      this.paymentStatus.processing = false;
      this.billingClientService.emitEvent(BillingEvents.SUBSCRIPTION_UPDATED, payload );
    }, err => {
      this.paymentStatus.error = true;
      this.paymentStatus.success = false;
      this.paymentStatus.processing = false;
      this.billingClientService.emitEvent(BillingEvents.SUBSCRIPTION_UPDATE_ERROR, err );
    });
  }


  onRetryPayment() {
    this.paymentStatus.error = false;
    this.paymentStatus.processing = false;
    this.paymentStatus.success = false;
    this.modalRef = this.modalService.show(this.billingClientTemplate);
  }

  closeModal() {
    this.modalRef.hide();
    setTimeout(() => {
      this.modalRef = null;
      this.allocations = null;
    }, 220);
  }

  addPaymentMethod() {
    this.modalRef.hide();
    this.savedQuantities = this.allocationsArray.value.map(a => a.calculated?.changedQuantity);
    setTimeout(() => this.paymentMethodModal.open(), 220);
  }

  accountCreated(account: any) {
    if (account) {
      this.accounts = [{
        name: `**** **** **** ${account.inboundProvider?.blueSnap?.cardInfo?.lastFourDigits || account.lastDigits}`,
        value: account._id,
        default: account.defaultSending
      }, ...this.accounts];
      this.subscriptionForm.get('accountId').setValue(account._id);
    }
    this.modalRef = this.modalService.show(this.billingClientTemplate);
  }





}
