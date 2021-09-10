import { NgModule, ModuleWithProviders } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BillingClientComponent } from './billing-client.component';
import { ModalModule } from 'ngx-bootstrap/modal';
import { ReactiveFormsModule } from '@angular/forms';
import { TooltipModule } from 'ngx-bootstrap/tooltip';
import { NgSelectModule } from '@ng-select/ng-select';
import { FeatureControlComponent } from './feature-control/feature-control.component';
import { PaymentMethodModalComponent } from './payment-method-modal/payment-method-modal.component';
import { NgxMaskModule } from 'ngx-mask';
import { DigitOnlyDirective } from './only-digits.directive';
import { PaymentStatusModalComponent } from './payment-status-modal/payment-status-modal.component';
import { IBillingClientOptions, BILLING_CLIENT_OPTIONS } from './common';

@NgModule({
  declarations: [
    BillingClientComponent,
    FeatureControlComponent,
    PaymentMethodModalComponent,
    DigitOnlyDirective,
    PaymentStatusModalComponent
  ],
  imports: [
    ModalModule,
    CommonModule,
    ReactiveFormsModule,
    NgSelectModule,
    TooltipModule,
    NgxMaskModule
  ],
  exports: [BillingClientComponent, PaymentMethodModalComponent, PaymentStatusModalComponent]
})
export class BillingClientModule {

  public static forRoot(options?: IBillingClientOptions): ModuleWithProviders {
    return {
      ngModule: BillingClientModule,
      providers: [
        {
          provide: BILLING_CLIENT_OPTIONS,
          useValue: options
        }
      ]
    };
  }

 }
