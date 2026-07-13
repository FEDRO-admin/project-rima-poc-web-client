import { Component, inject } from '@angular/core';
import { SceneStore } from '../scene.store';
import { SceneService } from '../scene.service';

@Component({
  selector: 'rima-scene-toggle',
  standalone: true,
  template: `
    <button class="scene-toggle" (click)="toggle()" [attr.aria-label]="is3D() ? 'Switch to 2D' : 'Switch to 3D'">
      {{ is3D() ? '2D' : '3D' }}
    </button>
  `,
  styles: `
    .scene-toggle {
      position: absolute;
      top: 15px;
      right: 15px;
      z-index: 2;
      width: 32px;
      height: 32px;
      border: 1px solid rgba(110, 110, 110, 0.3);
      border-radius: 4px;
      background: #fff;
      color: #6e6e6e;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;

      &:hover {
        background: #f3f3f3;
        color: #2b2b2b;
      }
    }
  `,
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
