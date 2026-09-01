import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  effect,
  ElementRef,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import '@arcgis/map-components/dist/components/arcgis-daylight';
import '@arcgis/map-components/dist/components/arcgis-slice';
import '@arcgis/map-components/dist/components/arcgis-elevation-profile';
import '@arcgis/map-components/dist/components/arcgis-direct-line-measurement-3d';
import '@esri/calcite-components/dist/components/calcite-icon';
import ElevationProfileLineGround from '@arcgis/core/analysis/ElevationProfile/ElevationProfileLineGround';
import ElevationProfileLineScene from '@arcgis/core/analysis/ElevationProfile/ElevationProfileLineScene';
import { TranslocoModule } from '@jsverse/transloco';
import { ViewStore } from '../../view.store';
import { ViewService } from '../../view.service';

export type SceneTool = 'daylight' | 'slice' | 'elevation-profile' | 'measurement-3d';

@Component({
  selector: 'rima-scene-tools',
  imports: [TranslocoModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './scene-tools.component.html',
  styleUrl: './scene-tools.component.scss',
})
export class SceneToolsComponent {
  protected readonly viewStore = inject(ViewStore);
  private readonly viewService = inject(ViewService);

  protected readonly open = signal(false);
  protected readonly minimized = signal(false);
  protected readonly activeTool = signal<SceneTool | null>(null);

  private readonly daylightEl = viewChild<ElementRef<HTMLArcgisDaylightElement>>('daylightRef');
  private readonly sliceEl = viewChild<ElementRef<HTMLArcgisSliceElement>>('sliceRef');
  private readonly elevationProfileEl = viewChild<ElementRef<HTMLArcgisElevationProfileElement>>('elevationProfileRef');
  private readonly measurementEl = viewChild<ElementRef<HTMLArcgisDirectLineMeasurement3dElement>>('measurementRef');

  constructor() {
    this.closeOnModeChange();
    this.wireToolView();
  }

  protected toggle(): void {
    if (this.open()) {
      this.close();
    } else {
      this.open.set(true);
    }
  }

  protected close(): void {
    this.clearActiveTool();
    this.open.set(false);
    this.activeTool.set(null);
    this.minimized.set(false);
  }

  protected minimize(): void {
    this.minimized.set(true);
  }

  protected restore(): void {
    this.minimized.set(false);
  }

  protected selectTool(tool: SceneTool): void {
    this.clearActiveTool();
    this.activeTool.set(this.activeTool() === tool ? null : tool);
  }

  private closeOnModeChange(): void {
    effect(() => {
      const mode = this.viewStore.mode();
      untracked(() => {
        if (mode !== 'scene') {
          this.close();
        }
      });
    });
  }

  private wireToolView(): void {
    effect(() => {
      const daylight = this.daylightEl()?.nativeElement;
      const slice = this.sliceEl()?.nativeElement;
      const elevationProfile = this.elevationProfileEl()?.nativeElement;
      const measurement = this.measurementEl()?.nativeElement;
      const view = this.viewService.activeView();
      untracked(() => {
        if (!view || view.type !== '3d') return;
        if (daylight) daylight.view = view;
        if (slice) slice.view = view;
        if (elevationProfile) {
          elevationProfile.view = view;
          this.configureElevationProfiles(elevationProfile);
        }
        if (measurement) measurement.view = view;
      });
    });
  }

  private clearActiveTool(): void {
    switch (this.activeTool()) {
      case 'measurement-3d':
        this.measurementEl()?.nativeElement?.clear();
        break;
      case 'slice':
        this.sliceEl()?.nativeElement?.clear();
        break;
      case 'elevation-profile':
        this.elevationProfileEl()?.nativeElement?.clear();
        break;
      case 'daylight':
      case null:
        break;
    }
  }

  private async configureElevationProfiles(el: HTMLArcgisElevationProfileElement): Promise<void> {
    await el.componentOnReady();
    const hasSceneProfile = el.profiles?.some((p) => p.type === 'scene');
    if (!hasSceneProfile) {
      el.profiles.removeAll();
      el.profiles.add(new ElevationProfileLineGround());
      el.profiles.add(new ElevationProfileLineScene());
    }
  }
}
