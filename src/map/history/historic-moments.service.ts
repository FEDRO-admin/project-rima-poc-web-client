import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, Observable, of } from 'rxjs';
import { HistoricMomentEntry, HISTORIC_MOMENTS_URL } from './history-config';

@Injectable({
  providedIn: 'root',
})
export class HistoricMomentsService {
  private readonly http = inject(HttpClient);

  getHistoricMoments(): Observable<HistoricMomentEntry[]> {
    if (!HISTORIC_MOMENTS_URL) {
      return of([]);
    }
    return this.http.get<HistoricMomentEntry[]>(HISTORIC_MOMENTS_URL).pipe(catchError(() => of([])));
  }
}
