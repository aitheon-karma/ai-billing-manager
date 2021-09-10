import { NgModule, Optional, ModuleWithProviders, SkipSelf } from '@angular/core';
import { ApiModule } from './rest/api.module';
import { Configuration } from './rest/configuration';

@NgModule({
  declarations: [
  ],
  imports: [
    ApiModule
  ],
  providers: [
  ],
  exports: [
    ApiModule
  ]
})
export class BillingManagerModule {
  public static forRoot(configurationFactory: () => Configuration): ModuleWithProviders {
    return {
      ngModule: BillingManagerModule,
      providers: [
        { provide: Configuration, useFactory: configurationFactory }
      ]
    };
  }
  constructor(@Optional() @SkipSelf() parentModule: BillingManagerModule) {
    if (parentModule) {
      throw new Error('BillingManagerModule is already loaded. Import in your base AppModule only.');
    }
  }
}
