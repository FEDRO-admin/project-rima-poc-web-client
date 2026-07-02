import { Component, CUSTOM_ELEMENTS_SCHEMA, effect, ElementRef, inject, untracked, viewChild } from '@angular/core';
import '@arcgis/map-components/dist/components/arcgis-time-slider';
import TimeInterval from '@arcgis/core/time/TimeInterval';
import { MapViewService } from '../../view/view.service';
import { HistoryStore } from '../history.store';
import { HistoryService } from '../history.service';

@Component({
  selector: 'rima-time-slider',
  imports: [],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './time-slider.component.html',
  styleUrl: './time-slider.component.scss',
})
export class TimeSliderComponent {
  protected readonly historyStore = inject(HistoryStore);
  private readonly viewService = inject(MapViewService);
  private readonly historyService = inject(HistoryService);
  private readonly timeSliderElement = viewChild<ElementRef<HTMLArcgisTimeSliderElement>>('timeSlider');

  constructor() {
    effect(() => {
      const view = this.viewService.mapView();
      const fullTimeExtent = this.historyStore.fullTimeExtent();
      const el = this.timeSliderElement()?.nativeElement;
      untracked(() => {
        if (view && el) {
          el.view = view;
          if (fullTimeExtent) {
            el.fullTimeExtent = fullTimeExtent;
            el.stops = { interval: new TimeInterval({ value: 1, unit: 'days' }) };
          }
        }
      });
    });
  }

  protected onTimeExtentChange(event: CustomEvent): void {
    const propertyName = event.detail?.propertyName;
    if (propertyName !== 'timeExtent') return;

    const el = this.timeSliderElement()?.nativeElement;
    const timeExtent = el?.timeExtent;
    if (timeExtent?.start) {
      this.historyService.applyHistoricMoment(timeExtent.start);
    }
  }
}
