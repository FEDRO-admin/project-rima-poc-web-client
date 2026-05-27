import { Component, ElementRef, HostListener, inject, viewChild } from '@angular/core';
import { PopupStore } from './popup.store';
import { PopupContentComponent } from './content/popup-content.component';
import { MapViewService } from '../view/view.service';
import { PopupClickService } from './popup-click.service';
import Graphic from '@arcgis/core/Graphic';

@Component({
  selector: 'rima-popup',
  imports: [PopupContentComponent],
  templateUrl: './popup.component.html',
  styleUrl: './popup.component.scss',
})
export class PopupComponent {
  protected readonly store = inject(PopupStore);
  private readonly viewService = inject(MapViewService);
  private readonly popupClickService = inject(PopupClickService);

  private dragging = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.store.close();
  }

  close(): void {
    this.store.close();
  }

  zoomTo(): void {
    const graphic = this.store.selectedGraphic();
    const view = this.viewService.mapView();
    if (!graphic?.geometry || !view) return;
    view.goTo({ target: graphic.geometry, zoom: 15 });
  }

  getFeatureLabel(graphic: Graphic): string {
    const attrs = graphic.attributes;
    if (!attrs) return 'Feature';
    return attrs.OBJECTID ?? attrs.FID ?? attrs.ID ?? Object.values(attrs)[0] ?? 'Feature';
  }

  onDragStart(event: MouseEvent): void {
    if (this.store.docked()) return;
    this.dragging = true;
    const screenPoint = this.store.screenPoint();
    if (screenPoint) {
      this.dragOffsetX = event.clientX - screenPoint.x;
      this.dragOffsetY = event.clientY - screenPoint.y;
    }
    event.preventDefault();
  }

  @HostListener('document:mousemove', ['$event'])
  onDragMove(event: MouseEvent): void {
    if (!this.dragging) return;
    const raw = {
      x: event.clientX - this.dragOffsetX,
      y: event.clientY - this.dragOffsetY,
    };
    this.store.updatePosition(this.popupClickService.clampScreenPoint(raw.x, raw.y));
  }

  @HostListener('document:mouseup')
  onDragEnd(): void {
    if (!this.dragging) return;
    this.dragging = false;

    const view = this.viewService.mapView();
    const screenPoint = this.store.screenPoint();
    if (view && screenPoint) {
      const mapPoint = view.toMap(screenPoint);
      if (mapPoint) {
        this.store.updateAnchor(screenPoint, mapPoint);
      }
    }
  }
}
