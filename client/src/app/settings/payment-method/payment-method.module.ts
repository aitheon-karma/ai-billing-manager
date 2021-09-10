import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PaymentMethodDashboardComponent } from './payment-method-dashboard/payment-method-dashboard.component';
import { PaymentMethodCardComponent } from './payment-method-card/payment-method-card.component';
import { PaymentMethodRoutingModule } from './payment-method-routing.module';
import { CoreClientModule } from '@aitheon/core-client';
import { BillingClientModule } from '@aitheon/billing-client';


@NgModule({
  declarations: [
    PaymentMethodDashboardComponent,
    PaymentMethodCardComponent
  ],
  imports: [

    CommonModule,
    PaymentMethodRoutingModule,
    CoreClientModule,
    BillingClientModule
  ]
})
export class PaymentMethodModule { }
