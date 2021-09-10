import { Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { BsModalService, BsModalRef } from 'ngx-bootstrap/modal';

@Component({
  selector: 'ai-discount-bonus',
  templateUrl: './discount-bonus.component.html',
  styleUrls: ['./discount-bonus.component.scss']
})
export class DiscountBonusComponent implements OnInit {
  buyACUModalRef: BsModalRef;

  @ViewChild('buyACUModal') buyACUModal: TemplateRef<any>;

  constructor(
    private modalService: BsModalService
  ) { }

  ngOnInit() {
  }

  openBuyACUModal(buyACUModal: TemplateRef<any>) {
    this.buyACUModalRef = this.modalService.show(buyACUModal,
      Object.assign({}, { class: 'modal-sm' })
    );
  }

  closeBuyACUModal(buyACUModal: TemplateRef<any>) {
    this.buyACUModalRef.hide();
  }
}
