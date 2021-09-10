import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PaymentMethodModule } from './payment-method/payment-method.module';
import { SettingsRoutingModule } from './settings-routing.module';


@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    PaymentMethodModule,
    SettingsRoutingModule
  ]
})
export class SettingsModule { }
