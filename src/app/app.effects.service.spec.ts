import { TestBed } from '@angular/core/testing';

import { AppEffectsService } from './app.effects.service';

describe('AppEffectsService', () => {
  let service: AppEffectsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AppEffectsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
