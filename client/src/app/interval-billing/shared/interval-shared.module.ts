import { NgModule } from '@angular/core';
import { CoreClientModule } from '@aitheon/core-client';

import { TableComponent } from './table/table.component';
import { FillRowsPipe } from './pipes/fill-rows.pipe';
import { PaginationComponent } from './pagination/pagination.component';

@NgModule({
  declarations: [
    TableComponent,
    FillRowsPipe,
    PaginationComponent
  ],
  imports: [
    CoreClientModule,
  ],
  exports: [
    TableComponent,
    CoreClientModule,
  ],
})
export class IntervalSharedModule {}
