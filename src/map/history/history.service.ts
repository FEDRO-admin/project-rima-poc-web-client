import { inject, Injectable } from '@angular/core';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import esriRequest from '@arcgis/core/request';
import { ViewService } from '../view/view.service';
import { HistoryStore } from './history.store';
import { HistoryEntry } from './history-entry';
import { HISTORIC_MOMENTS_URL, HISTORIC_MOMENTS_ADD_URL, HISTORIC_MOMENTS_DELETE_URL } from './history-config';

interface HistoricMomentResult {
  success: boolean;
  message?: string;
}

@Injectable({
  providedIn: 'root',
})
export class HistoryService {
  private readonly viewService = inject(ViewService);
  private readonly historyStore = inject(HistoryStore);

  applyDate(date: Date): void {
    this.historyStore.setSelectedMoment(null);
    this.historyStore.activate(date);
    this.applyHistoricMoment(date);
  }

  clearHistoricMoment(): void {
    this.historyStore.setSelectedMoment(null);
    this.historyStore.deactivate();
    const layers = this.getFeatureLayers();
    for (const layer of layers) {
      layer.historicMoment = null;
      layer.refresh();
    }
  }

  async loadMoments(): Promise<void> {
    this.historyStore.setMomentsLoading();
    const moments = await this.getHistoricMoments();
    this.historyStore.setMoments(moments);
  }

  async submitAdd(name: string, date: Date): Promise<boolean> {
    this.historyStore.setErrorMessage('');
    const timestamp = `${date.toISOString().slice(0, -1)}Z`;
    const result = await this.addHistoricMoment(name, timestamp);
    if (result.success) {
      await this.loadMoments();
      return true;
    } else {
      this.historyStore.setErrorMessage(result.message ?? 'Failed to add marker');
      return false;
    }
  }

  async executeDelete(entry: HistoryEntry): Promise<boolean> {
    this.historyStore.setConfirmingDelete(null);
    this.historyStore.setErrorMessage('');
    const result = await this.deleteHistoricMoment(entry.name);
    if (result.success) {
      await this.loadMoments();
      return true;
    } else {
      this.historyStore.setErrorMessage(result.message ?? 'Failed to delete marker');
      return false;
    }
  }

  private applyHistoricMoment(date: Date): void {
    const layers = this.getFeatureLayers();
    for (const layer of layers) {
      layer.historicMoment = date;
      layer.refresh();
    }
  }

  private getFeatureLayers(): FeatureLayer[] {
    const view = this.viewService.activeView();
    if (!view?.map) return [];

    const layers: FeatureLayer[] = [];
    view.map.allLayers.forEach((layer) => {
      if (layer instanceof FeatureLayer) {
        layers.push(layer);
      }
    });
    return layers;
  }

  private async getHistoricMoments(): Promise<HistoryEntry[]> {
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

  private async addHistoricMoment(name: string, timestamp: string): Promise<HistoricMomentResult> {
    try {
      const response = await esriRequest(HISTORIC_MOMENTS_ADD_URL, {
        query: { f: 'json', name, timestamp },
        responseType: 'json',
      });
      const data = response.data as Record<string, unknown>;
      if (data?.['status'] === 'error') {
        return { success: false, message: (data['message'] as string) ?? 'Unknown error' };
      }
      return { success: true };
    } catch (error) {
      return { success: false, message: String(error) };
    }
  }

  private async deleteHistoricMoment(name: string): Promise<HistoricMomentResult> {
    try {
      const response = await esriRequest(HISTORIC_MOMENTS_DELETE_URL, {
        query: { f: 'json', name },
        responseType: 'json',
      });
      const data = response.data as Record<string, unknown>;
      if (data?.['status'] === 'error') {
        return { success: false, message: (data['message'] as string) ?? 'Unknown error' };
      }
      return { success: true };
    } catch (error) {
      return { success: false, message: String(error) };
    }
  }
}
