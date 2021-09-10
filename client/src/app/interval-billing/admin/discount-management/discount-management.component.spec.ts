import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { DiscountManagementComponent } from './discount-management.component';

describe('DiscountManagementComponent', () => {
  let component: DiscountManagementComponent;
  let fixture: ComponentFixture<DiscountManagementComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ DiscountManagementComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(DiscountManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
