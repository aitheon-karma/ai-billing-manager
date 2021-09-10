import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { InvoiceHistoryDashboardComponent } from './invoice-history-dashboard.component';

describe('InvoiceHistoryDashboardComponent', () => {
  let component: InvoiceHistoryDashboardComponent;
  let fixture: ComponentFixture<InvoiceHistoryDashboardComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ InvoiceHistoryDashboardComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(InvoiceHistoryDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
