import { Component, inject } from '@angular/core';
import { SceneStore } from '../scene.store';
import { SceneService } from '../scene.service';

@Component({
  selector: 'rima-scene-toggle',
  standalone: true,
  templateUrl: './scene-toggle.component.html',
  styleUrl: './scene-toggle.component.scss',
})
export class SceneToggleComponent {
  private readonly sceneStore = inject(SceneStore);
  private readonly sceneService = inject(SceneService);

  protected readonly is3D = (): boolean => this.sceneStore.mode() === '3d';

  toggle(): Promise<void> {
    if (this.sceneStore.mode() === '2d') {
      return this.sceneService.switchTo3D();
    } else {
      return this.sceneService.switchTo2D();
    }
  }
}
