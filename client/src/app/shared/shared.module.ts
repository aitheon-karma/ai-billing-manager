import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ServiceIconPipe } from './pipes/service-icon.pipe';
import { TooltipModule } from 'ngx-bootstrap/tooltip';



@NgModule({
  declarations: [
    ServiceIconPipe
  ],
  imports: [
    CommonModule
  ],
  exports: [
    ServiceIconPipe,
    TooltipModule
  ]
})
export class SharedModule { }
