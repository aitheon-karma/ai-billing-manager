import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';

@Component({
  selector: 'ai-discount-form',
  templateUrl: './discount-form.component.html',
  styleUrls: ['./discount-form.component.scss']
})
export class DiscountFormComponent implements OnInit {
  discountForm: FormGroup;
  submitted: boolean = false;

  @Output() formMode = new EventEmitter<boolean>();

  options = [
    "One", "Two", "Three", "Four", "Five"
  ]

  config = {
    placeholder: 'Choose',
    search: false,
  };

  constructor(
    private fb: FormBuilder
  ) { }

  ngOnInit() {
    this.discountForm = this.fb.group({
      name: ['',Validators.required],
      description: ['',Validators.required],
      appliesTo: ['',Validators.required],
      unit: ['',Validators.required],
      units: ['',Validators.required],
      percentage: ['',Validators.required],
      toWhomDiscount: ['',Validators.required],
      forWhatSpend: ['',Validators.required],
      whereShouldSpend: ['',Validators.required],
      howMuchSpend: ['',Validators.required],
      howLongSpend: ['',Validators.required],
    });
  }

  onSubmit() {
    this.submitted = true;
    if (!this.discountForm.valid) {
      return;
    }
  }

  goBack() {
    this.formMode.emit(false);
  }
}
