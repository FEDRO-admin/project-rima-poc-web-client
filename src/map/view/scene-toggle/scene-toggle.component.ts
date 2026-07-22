import { Component, inject } from '@angular/core';
import { ViewStore } from '../view.store';
import { MapViewService } from '../view.service';

@Component({
  selector: 'rima-scene-toggle',
  standalone: true,
  templateUrl: './scene-toggle.component.html',
  styleUrl: './scene-toggle.component.scss',
})
export class SceneToggleComponent {
  private readonly viewStore = inject(ViewStore);
  private readonly viewService = inject(MapViewService);

  protected readonly is3D = (): boolean => this.viewStore.mode() === '3d';

  toggle(): Promise<void> {
    if (this.viewStore.mode() === '2d') {
      return this.viewService.switchTo3D();
    } else {
      return this.viewService.switchTo2D();
    }
  }
}
