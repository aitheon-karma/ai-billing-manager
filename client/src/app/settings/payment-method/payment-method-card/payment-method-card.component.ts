import { Component, OnInit, Input, TemplateRef, EventEmitter, Output } from '@angular/core';


@Component({
  selector: 'ai-payment-method-card',
  templateUrl: './payment-method-card.component.html',
  styleUrls: ['./payment-method-card.component.scss']
})
export class PaymentMethodCardComponent implements OnInit {
  @Input() type: string;
  @Input() card: any;
  @Output() setMainCardEvent: EventEmitter<any> = new EventEmitter();
  @Output() deleteCardEvent: EventEmitter<any> = new EventEmitter();


  constructor() { }

  ngOnInit(): void {
  }

  setCardAsMain(card: any, event: any) {
    event.preventDefault();
    event.stopPropagation();
    this.setMainCardEvent.emit(card);
  }

  deleteCard(card: any) {
    this.deleteCardEvent.emit(card);
  }

  getCardTypeLogo(cardType: string) {
    let logo;
    switch (cardType) {
      case 'VISA':
        logo = 'payment-card__logo--visa'
        break;
      case 'MASTERCARD':
        logo = 'payment-card__logo--mastercard'
        break;
      case 'DISCOVER':
        logo = 'payment-card__logo--discover'
        break;
      case 'UNIONPAY':
        logo = 'payment-card__logo--unionpay'
        break;
      case 'JCB':
        logo = 'payment-card__logo--jcb'
        break;
      case 'AMEX':
        logo = 'payment-card__logo--american-express'
        break;
    }

    return logo;
  }
}
