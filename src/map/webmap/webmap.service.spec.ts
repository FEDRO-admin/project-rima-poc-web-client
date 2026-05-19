import { TestBed } from '@angular/core/testing';

import { WebmapService } from './webmap.service';

describe('WebmapService', () => {
  let service: WebmapService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(WebmapService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
