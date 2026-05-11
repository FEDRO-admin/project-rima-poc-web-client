import { Injectable, signal } from '@angular/core';

export interface SearchResult {
  name: string;
  longitude: number;
  latitude: number;
}

@Injectable({ providedIn: 'root' })
export class SearchService {
  readonly searchTerm = signal('');
  readonly selectedResult = signal<SearchResult | null>(null);

  setSelectedResult(result: SearchResult | null): void {
    this.selectedResult.set(result);
  }

  clearSearch(): void {
    this.searchTerm.set('');
    this.selectedResult.set(null);
  }
}
