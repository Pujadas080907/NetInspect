import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LoadArchipelago } from './load-archipelago';

describe('LoadArchipelago', () => {
  let component: LoadArchipelago;
  let fixture: ComponentFixture<LoadArchipelago>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoadArchipelago],
    }).compileComponents();

    fixture = TestBed.createComponent(LoadArchipelago);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
