import { TestBed } from '@angular/core/testing';

import { MapViewService } from './mapview.service';

describe('MapviewService', () => {
  let service: MapViewService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MapViewService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
