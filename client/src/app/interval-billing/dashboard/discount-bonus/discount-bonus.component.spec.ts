import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { DiscountBonusComponent } from './discount-bonus.component';

describe('DiscountBonusComponent', () => {
  let component: DiscountBonusComponent;
  let fixture: ComponentFixture<DiscountBonusComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ DiscountBonusComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(DiscountBonusComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
