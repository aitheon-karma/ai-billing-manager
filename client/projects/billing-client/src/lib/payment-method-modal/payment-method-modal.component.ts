import { Component, OnInit, ViewChild, ChangeDetectionStrategy, ChangeDetectorRef, Output, EventEmitter } from '@angular/core';
import { ModalDirective } from 'ngx-bootstrap/modal';
import { FormGroup, Validators, FormBuilder } from '@angular/forms';
import { BluesnapScriptLoader } from '../bluesnap-script-loader.service';
import { BillingClientService } from '../billing-client.service';
import { BsModalService, BsModalRef } from 'ngx-bootstrap/modal';

declare const BlueSnap: any;
@Component({
  selector: 'ai-payment-method-modal',
  templateUrl: './payment-method-modal.component.html',
  styleUrls: ['./payment-method-modal.component.scss']
})
export class PaymentMethodModalComponent implements OnInit {

  constructor(private fb: FormBuilder,
    private billingClientService: BillingClientService,
    private modalService: BsModalService,
    private bluesnapScriptLoader: BluesnapScriptLoader) { }

  @ViewChild('paymentMethodTemplate') paymentMethodTemplate: ModalDirective;
  @ViewChild('paymentStatusTemplate') paymentStatusTemplate: ModalDirective;
  createAccountForm: FormGroup;
  bluesnap: any;
  currentYear = (new Date()).getFullYear();
  cardYears = Array(20).fill(0).map((e, index) => ({ name: (this.currentYear + index).toString() }));
  cardMonths = Array(12).fill(0).map((e, index) => ({ name: index < 9 ? '0' + (index + 1) : index + 1 }));
  accountTypes: any;
  accountSubmitted = false;
  createAccountMode = true;
  loading = true;
  modalRef: BsModalRef;
  @Output() accountCreated = new EventEmitter<any>();

  ngOnInit(): void {

    this.loading = true;
    this.billingClientService.bluesnapClientKey().subscribe(credentials => {
      this.loadBlueSnapScript(atob(credentials.clientKey));
    });
  }

  open() {
    this.modalRef = this.modalService.show(this.paymentMethodTemplate, {class: 'modal-sm', ignoreBackdropClick: true});
    this.buildCreateAccountForm();
    this.loading = false;
  }




  private buildCreateAccountForm() {
    this.accountSubmitted = false;
    this.createAccountForm = this.fb.group({
      bankName: [''],
      type: [null],
      cardHolderFirstName: ['', Validators.required],
      cardHolderLastName: ['', Validators.required],
      lastDigits: [''],
      creditCard: ['', [Validators.required, Validators.maxLength(19), Validators.minLength(15)]],
      expirationMonth: [null, Validators.required],
      expirationYear: [null, Validators.required],
      cvv: [''],
      dueDate: [null],
    });
  }


  onAccountSubmit() {
    this.accountSubmitted = true;
    if (this.createAccountForm.invalid) {
      return;
    }

    this.bluesnap.encrypt('account-form');
    const form: any = document.getElementById('account-form');
    const inputs: HTMLInputElement[] = form.querySelectorAll('input');
    const cardInfo: any = {};


    for (const item of inputs) {
      if (item.name === 'encryptedCreditCard') {
        cardInfo.encryptedCreditCard = item.value;
      } else if (item.name === 'encryptedCvv') {
        cardInfo.encryptedCvv = item.value;
      }
    }
    const value = Object.assign({}, this.createAccountForm.value);
    cardInfo.cardHolderFirstName = value.cardHolderFirstName;
    cardInfo.cardHolderLastName = value.cardHolderLastName;
    cardInfo.bankName = `${value.cardHolderFirstName} ${value.cardHolderLastName}`;

    cardInfo.expirationMonth = value.expirationMonth;
    cardInfo.dueDate = value.dueDate;
    cardInfo.expirationYear = value.expirationYear;

    const cardNumber = (value.creditCard as number).toString();
    const account = {
      bankName: `${value.cardHolderFirstName} ${value.cardHolderLastName}`,
      lastDigits: cardNumber.substr(cardNumber.length - 4, cardNumber.length),
      type: 'CREDIT_CARD'
    };

    const inboundAccount = { account, cardInfo };
    this.loading = true;
    this.billingClientService.createFiatInboundAccount(inboundAccount)
      .subscribe(fiatInboundAccount => {
        this.modalRef.hide();
        this.buildCreateAccountForm();
        setTimeout(() => { this.accountCreated.emit(fiatInboundAccount); this.loading = false; }, 240);
      }, err => {
        this.loading = false;
        setTimeout(() => this.createAccountForm.get('creditCard').setErrors({ invalidCard: true }), 10);
      });

  }



  private loadBlueSnapScript(key: string) {
    this.bluesnapScriptLoader.load('bluesnap').then(data => {
      this.bluesnap = new BlueSnap(key, false);
    }
    ).catch(error => console.error('Could not load Blue Snap'));
  }

  close() {
    this.accountSubmitted = false;
    this.modalRef.hide();
    setTimeout(() => this.accountCreated.emit(null), 220);
  }


}
