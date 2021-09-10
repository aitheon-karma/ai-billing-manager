import { NgModule } from '@angular/core';
import { CoreClientModule } from '@aitheon/core-client';
import { AppComponent } from './app.component';
import { environment } from '../environments/environment';
import { DashboardModule } from './dashboard/dashboard.module';
import { AppRoutingModule } from './app-routing.module';
import { BillingManagerModule, Configuration, ConfigurationParameters } from '@aitheon/billing-manager';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { BillingClientModule  } from '@aitheon/billing-client';
import { SubHeaderComponent } from './sub-header/sub-header.component';
import { TreasuryModule } from '@aitheon/treasury';
import { SharedModule } from "./shared/shared.module";


export function apiConfigFactory (): Configuration {
  const params: ConfigurationParameters = {
    basePath: '.'
  };
  return new Configuration(params);
}

export function treasuryApiConfigFactory(): Configuration {
  const params: ConfigurationParameters = {
    basePath: `${environment.baseApi}/treasury`
  };
  return new Configuration(params);
}

@NgModule({
  declarations: [
    AppComponent,
    SubHeaderComponent,
  ],
  imports: [
    CoreClientModule.forRoot({
      service: environment.service,
      baseApi: environment.baseApi,
      production: environment.production
    }),
    AppRoutingModule,
    BrowserAnimationsModule,
    DashboardModule,
    BillingClientModule.forRoot({service: environment.service}),
    BillingManagerModule.forRoot(apiConfigFactory),
    TreasuryModule.forRoot(treasuryApiConfigFactory),
    SharedModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
