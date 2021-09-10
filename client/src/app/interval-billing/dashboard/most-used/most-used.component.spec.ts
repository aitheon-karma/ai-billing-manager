import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { MostUsedComponent } from './most-used.component';

describe('MostUsedComponent', () => {
  let component: MostUsedComponent;
  let fixture: ComponentFixture<MostUsedComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ MostUsedComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(MostUsedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
