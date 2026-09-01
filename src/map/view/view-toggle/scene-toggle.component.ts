import { Component, inject } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { ViewStore } from '../view.store';
import { ViewService } from '../view.service';

@Component({
  selector: 'rima-scene-toggle',
  imports: [TranslocoModule],
  templateUrl: './scene-toggle.component.html',
  styleUrl: './scene-toggle.component.scss',
})
export class SceneToggleComponent {
  private readonly viewStore = inject(ViewStore);
  private readonly viewService = inject(ViewService);

  protected readonly isScene = (): boolean => this.viewStore.mode() === 'scene';

  toggle(): Promise<void> {
    if (this.viewStore.mode() === 'map') {
      return this.viewService.switchToScene();
    } else {
      return this.viewService.switchToMap();
    }
  }
}
