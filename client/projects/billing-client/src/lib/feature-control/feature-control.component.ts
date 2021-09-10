import { Component, OnInit, Input, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, NG_VALIDATORS, FormControl, FormBuilder } from '@angular/forms';
import { Allocation, toFixedNumber } from '../common';
@Component({
  selector: 'ai-feature-control',
  templateUrl: './feature-control.component.html',
  styleUrls: ['./feature-control.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => FeatureControlComponent),
      multi: true
    }
  ]
})
export class FeatureControlComponent implements OnInit, ControlValueAccessor {
  constructor() { }


  @Input() allocation: Allocation;
  @Input() savedQuantity = 0;

  pricePerQuantity = 0;
  initQuantity: number;
  disabled = false;
  private _quantity = 0;
  private _totalQuantity = 0;
  private _purchasedQuantity = 0;
  previousButtonDisabled = false;


  onChange: (_: any) => {};
  onTouchFn = () => {};

  set totalQuantity(value: number) {
    if (value >= 0 ) {
      if (value < this.allocation.used) {
        this.previousButtonDisabled = true;
        return;
      }
      this.previousButtonDisabled = false;
      this._totalQuantity = value;
      this._quantity = this._totalQuantity - this._purchasedQuantity;
      this.calculatePrice();
    }
  }

  get totalQuantity() {
    return this._totalQuantity;
  }

  calculatePrice() {
    let rangeIndex = -1;
    const rangesLength = this.allocation.itemPrice.ranges.length - 1;
    for (let i = rangesLength ; i >= 0 ; i--) {
      if (this.totalQuantity >= this.allocation.itemPrice.ranges[i] ) {
          rangeIndex = i;
          break;
      }
    }
    if (rangeIndex === -1 || typeof this.allocation.itemPrice.prices[rangeIndex][1] !== 'number') {
      this.pricePerQuantity = this.allocation.itemPrice.prices[rangeIndex] && this.allocation.itemPrice.prices[rangeIndex][0] || 0;
      return this.writeToControl();
    }
    const prices = this.allocation.itemPrice.prices[rangeIndex].sort((a, b) => a - b) || [0];
    const rangeLow = this.allocation.itemPrice.ranges[rangeIndex];
    const rangeHigh = this.allocation.itemPrice.ranges[rangeIndex + 1] - 1 || Infinity;
    this.pricePerQuantity = (1 - (this.totalQuantity - rangeLow) / (rangeHigh - rangeLow)) * (prices[1] - prices[0]) + prices[0];
    // this.price = (prices[1] - (((prices[1]  - prices[0] ) / (rangeHigh - rangeLow)) * (this.quantity - rangeLow)));
    return this.writeToControl();
  }


  writeToControl() {
    let modifier = 1;
    if (this.allocation.monthlyPriceMultiplier && this.allocation.billingInterval === 1) {
      modifier = this.allocation.monthlyPriceMultiplier;
    }

    const result = {
       totalPrice: this.pricePerQuantity * this.totalQuantity,
       oneTimePrice: this.pricePerQuantity * this._quantity,
       oneTimePriceWithModifier: toFixedNumber(this.pricePerQuantity * this._quantity  * modifier),
       pricePerQuantity: this.pricePerQuantity,
       totalQuantity: this.totalQuantity,
       changedQuantity: this._quantity
      };
    this.onChange(result);
  }


  writeValue(quantity: number): void {

  }


  registerOnChange(fn: any): void {
    this.onChange = fn;
    if (typeof this.allocation.quantity === 'number') {
      this._purchasedQuantity = this.allocation.quantity;
      this.totalQuantity = this.allocation.quantity;
      if (this.savedQuantity) {
        this.totalQuantity = this.totalQuantity + this.savedQuantity;
      }
    }
  }
  registerOnTouched(fn: any): void {
   this.onTouchFn = fn;
  }
  setDisabledState?(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  ngOnInit(): void {
    this.initQuantity = this.allocation.quantity;
  }
}
