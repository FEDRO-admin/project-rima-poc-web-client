import { Injectable } from '@angular/core';
import esriRequest from '@arcgis/core/request';
import { HistoricMomentEntry, HISTORIC_MOMENTS_URL } from './history-config';

@Injectable({
  providedIn: 'root',
})
export class HistoricMomentsService {
  async getHistoricMoments(): Promise<HistoricMomentEntry[]> {
    if (!HISTORIC_MOMENTS_URL) {
      return [];
    }
    try {
      const response = await esriRequest(HISTORIC_MOMENTS_URL, {
        query: { f: 'json' },
        responseType: 'json',
      });
      let data = response.data as Record<string, unknown>;
      if (!data || typeof data !== 'object') {
        return [];
      }
      // If the response is wrapped (e.g. { historicMoments: {...} }), unwrap it
      const values = Object.values(data);
      if (values.length === 1 && values[0] && typeof values[0] === 'object' && !Array.isArray(values[0])) {
        data = values[0] as Record<string, unknown>;
      }
      return Object.entries(data)
        .filter(([key]) => key !== 'DEFAULT')
        .filter(([, value]) => typeof value === 'string')
        .map(([name, date]) => ({ name, date: date as string }));
    } catch {
      return [];
    }
  }
}
