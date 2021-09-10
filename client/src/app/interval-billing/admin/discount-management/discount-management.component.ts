import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'ai-discount-management',
  templateUrl: './discount-management.component.html',
  styleUrls: ['./discount-management.component.scss']
})
export class DiscountManagementComponent implements OnInit {
  checked: boolean;
  formMode: boolean = false;

  constructor() { }

  ngOnInit() {
  }

  toggleSwitch(event: Event) {
    this.checked = !this.checked;
  }

  startFormMode() {
    this.formMode = true;
  }
}
