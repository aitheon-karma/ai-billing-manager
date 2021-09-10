import { BillingClientService, PaymentMethodModalComponent } from '@aitheon/billing-client';
import { FiatAccount, FiatAccountsRestService } from '@aitheon/treasury';
import { Component, OnDestroy, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { BsModalService, BsModalRef } from 'ngx-bootstrap/modal';
import { map, concatMap } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '@aitheon/core-client';
import { BillingStatusService, CurrentBillingStatus } from '../../../shared/services/billing-status.service';
import { Subscription as RxJsSubscription } from "rxjs/internal/Subscription";

interface CardInfo {
  type: string;
  expirationMonth: number;
  expirationYear: number;
  lastFourDigits: number;
  _id: string;
  organization: string;
  user: string;
  isMain: boolean;
}

@Component({
  selector: 'ai-payment-method-dashboard',
  templateUrl: './payment-method-dashboard.component.html',
  styleUrls: ['./payment-method-dashboard.component.scss']
})
export class PaymentMethodDashboardComponent implements OnInit, OnDestroy {
  @ViewChild('setMainCard') setMainCardModal: TemplateRef<any>;
  @ViewChild('deleteCardModal') deleteCardModal: TemplateRef<any>;

  @ViewChild(PaymentMethodModalComponent) paymentMethodModalComponent: PaymentMethodModalComponent;


  userCards: CardInfo[] = [];
  nonDefaultCards: CardInfo[];
  modalRef: BsModalRef;
  deleteModalRef: BsModalRef;
  newMainCardId: string;
  changedNewMainCard: CardInfo;
  accounts: FiatAccount[];
  loading = true;
  deleteModalMode: string;
  selectedCard: CardInfo;
  status: CurrentBillingStatus;
  subscriptions = new RxJsSubscription();


  constructor(private modalService: BsModalService,
    private toastr: ToastrService,
    private authService: AuthService,
    private fiatAccountService: FiatAccountsRestService,
    private billingClientService: BillingClientService,
    private billingStatusService: BillingStatusService) { }

  ngOnInit(): void {
    this.getAccounts();
    if (!this.authService.production) {
      this.authService.activeOrganization.subscribe(org => {
        this.fiatAccountService.defaultHeaders = this.fiatAccountService.defaultHeaders.set('organization-id', org._id);
      });
    }

    this.subscriptions.add(this.billingStatusService.getCurrentUser().subscribe(res => {
      this.status = res;
    }));
  }

  addPaymentMethod() {
    this.paymentMethodModalComponent.open();
  }

  getAccounts() {
    this.loading = true;
    this.billingClientService.listActiveInboundFiatAccounts()
      .pipe(map(this.accountsMapper)).subscribe(result => {
        this.userCards = result;
        this.nonDefaultCards = this.userCards.filter(c => !c.isMain);
        this.loading = false;
      }, err => {
        this.loading = false;
        this.toastr.error('Something went wrong, please try again later');
      });
  }

  get activeCard() {
    return this.userCards.find(c => c.isMain);
  }

  private accountsMapper(accounts: FiatAccount[]) {
    const userCards = [];
    for (const account of accounts) {
      const cardInfo = account.inboundProvider.blueSnap.cardInfo;
      const card = {
        _id: account._id,
        lastFourDigits: cardInfo.lastFourDigits.toString(),
        organization: account.organization,
        expirationMonth: cardInfo.expirationMonth,
        expirationYear: cardInfo.expirationYear,
        type: cardInfo.cardType,
        user: account.user,
        isMain: account.defaultSending
      };
      userCards.push(card);
    }
    return userCards;
  }


  openSetMainCardModal(card: CardInfo) {
    this.modalRef = this.modalService.show(this.setMainCardModal);
    this.changedNewMainCard = card;
  }

  changeMainCard() {
    if (this.modalRef) {
      this.modalRef.hide();
    }
    const payload = (({_id, organization, user}) => ({_id, organization, user}))(this.changedNewMainCard);
    this.fiatAccountService.setDefaultById(this.changedNewMainCard._id, {account: payload, provider: 'defaultSending'}).subscribe(() => {
      this.toastr.success('Default card changed');
      this.getAccounts();
    });
  }

  onDeleteCard(card: any) {
    this.selectedCard = card;
    this.deleteModalMode = card.isMain ? 'main' : '';
    this.newMainCardId = null;
    this.deleteModalRef = this.modalService.show(this.deleteCardModal, { ignoreBackdropClick: true });
  }

  deleteCard(card: any) {
    this.fiatAccountService._delete(card._id).subscribe(result => {
      this.getAccounts();
      this.toastr.success('Card deleted');
    });
    this.closeDeleteCardModal();
  }

  deleteMainCard() {
    if (this.newMainCardId) {
      const currentDefaultAccountId = this.activeCard._id;
      const payload = (({_id, organization, user}) => ({_id, organization, user}))(this.userCards.find(c => c._id === this.newMainCardId));
      const default$ = this.fiatAccountService.setDefaultById(this.newMainCardId, {account: payload, provider: 'defaultSending'});
      const delete$ = this.fiatAccountService._delete(currentDefaultAccountId);
      default$.pipe(concatMap(() => delete$)).subscribe(res => {
          this.toastr.success('Card deleted');
          this.getAccounts();
      }, err => this.toastr.error('Something went wrong, please try again later'));
    }
    this.closeDeleteCardModal();
  }

  accountCreated(account: FiatAccount) {
      if (!account) { return; }
      this.toastr.success('Card added');
      this.getAccounts();
  }

  closeDeleteCardModal() {
    this.deleteModalRef.hide();
  }

  ngOnDestroy() {
    try {
      this.subscriptions.unsubscribe();
    } catch (e) {
      console.error(e)
    }
  }
}
