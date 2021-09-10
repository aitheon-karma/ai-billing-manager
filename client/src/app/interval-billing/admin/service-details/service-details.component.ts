import { Component, OnInit, Input, OnChanges, Output, EventEmitter } from '@angular/core';
import { Service } from '../../shared/services/service.model';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { AdminRestService, Price } from '@aitheon/billing-manager';
import * as moment from 'moment';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'ai-service-details',
  templateUrl: './service-details.component.html',
  styleUrls: ['./service-details.component.scss']
})
export class ServiceDetailsComponent implements OnInit, OnChanges {
  changeRateMode = false;
  date = new Date();
  priceForm: FormGroup;
  minDate: Date;

  private readonly INTERVAL_IN_MIN = 60;

  @Input() service: Service;
  @Input() priceType: Price.TypeEnum;
  @Input() prices: Price[];
  @Output() saved = new EventEmitter<boolean>();
  servicePrices: Price[];
  submitted = false;

  constructor(private _fb: FormBuilder,
     private adminRestService: AdminRestService,
     private toastr: ToastrService) { }

  ngOnInit() {

    this.minDate = new Date();

  }

  get startFrom() {
    return this.priceForm.get('startFrom');
  }

  get price() {
    return this.priceForm.get('price');
  }

  ngOnChanges() {

    this.submitted = false;
    this.servicePrices = this.prices.filter(p => p.service === this.service._id)
      .sort((p1, p2) => {
        return ((new Date(p2.startFrom)).getTime() - (new Date(p1.startFrom)).getTime());
      });

    // for now taking just the latest startFrom date
    const pricePerSecond = this.servicePrices && this.servicePrices.length ? this.servicePrices[0].pricePerSecond : 0;
    const startFrom = this.minDate;

    this.priceForm = this._fb.group({
      startFrom: this._fb.control(startFrom, [Validators.required]),
      price: this._fb.control(this.convertPrice(pricePerSecond), [Validators.required, Validators.min(0)])
    });

    this.changeRateModeOff();
  }

  changeRateModeOn() {
    this.price.enable();
    this.changeRateMode = true;
  }

  changeRateModeOff() {
    this.price.disable();
    this.changeRateMode = false;
    const pricePerSecond = this.servicePrices && this.servicePrices.length ? this.servicePrices[0].pricePerSecond : 0;
    this.price.setValue(this.convertPrice(pricePerSecond));
  }

  onSubmit() {
    const formPrice = { ...this.priceForm.value };
    this.submitted = true;
    if (this.priceForm.invalid) {
      return;
    }

    const price = new Price();
    price.service = this.service._id;
    price.type = this.priceType;
    price.pricePerSecond = formPrice.price / (this.INTERVAL_IN_MIN * 60); // converting to seconds
    price.startFrom = formPrice.startFrom;
    this.adminRestService.createPrice(price).subscribe(p => {
      this.toastr.success('Price saved');
      this.saved.emit(true);
    }, err => this.toastr.error(err.error.message));

  }

  convertPrice(pricePerSecond: number) {
    return ((pricePerSecond * 60) * this.INTERVAL_IN_MIN).toFixed(2);
  }

  deletePrice(price: Price) {
    this.adminRestService.deletePrice(price._id)
      .subscribe(p => {
        this.toastr.success('Price deleted');
        this.saved.emit(true);
      }, err => this.toastr.error('Could not delete this price'));
  }
}
