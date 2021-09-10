import { Component, OnInit, ViewChild, TemplateRef, Input, EventEmitter, Output } from '@angular/core';
import { BsModalService, BsModalRef } from 'ngx-bootstrap/modal';
import { BillingClientService } from '../billing-client.service';
import { PaymentStatus } from '../common';

@Component({
  selector: 'ai-payment-status-modal',
  templateUrl: './payment-status-modal.component.html',
  styleUrls: ['./payment-status-modal.component.scss']
})
export class PaymentStatusModalComponent implements OnInit {

  constructor(private modalService: BsModalService) { }

  @ViewChild('paymentStatusModal') paymentStatusTemplate: TemplateRef<any>;
  @Input() status: PaymentStatus;
  @Output() retry = new EventEmitter<boolean>();
  modalRef: BsModalRef;

  ngOnInit(): void {

  }

  open() {
    this.modalRef = this.modalService.show(this.paymentStatusTemplate, {class: 'modal-sm', ignoreBackdropClick: true});
  }

  close() {
    if (this.modalRef) {
      this.modalRef.hide();
      this.modalRef = null;
    }
  }

  onRetry() {
    setTimeout(() => this.retry.emit(true), 220);
    this.modalRef.hide();
  }

}
