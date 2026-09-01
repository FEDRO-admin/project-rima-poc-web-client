import { Component, CUSTOM_ELEMENTS_SCHEMA, effect, ElementRef, inject, untracked, viewChild } from '@angular/core';
import '@arcgis/map-components/dist/components/arcgis-feature-table';
import '@esri/calcite-components/dist/components/calcite-icon';
import Graphic from '@arcgis/core/Graphic';
import { TablePaneStore } from './table-pane.store';
import { TablePaneService } from './table-pane.service';
import { ViewService } from '../view/view.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'rima-table-pane',
  imports: [TranslocoModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './table-pane.component.html',
  styleUrl: './table-pane.component.scss',
})
export class TablePaneComponent {
  protected readonly store = inject(TablePaneStore);
  private readonly service = inject(TablePaneService);
  private readonly viewService = inject(ViewService);
  private readonly translocoService = inject(TranslocoService);
  private readonly tableElement = viewChild<ElementRef<HTMLArcgisFeatureTableElement>>('featureTable');

  constructor() {
    this.configureTableOnLayerChange();
  }

  private configureTableOnLayerChange(): void {
    effect(() => {
      const layer = this.store.layer();
      const visible = this.store.visible();
      const tableRef = this.tableElement();
      untracked(() => {
        const table = tableRef?.nativeElement;
        if (!table || !visible || !layer) return;

        table.layer = layer;
        table.view = this.viewService.activeView() ?? null;
        table.relatedRecordsEnabled = false;
        table.editingEnabled = false;
        table.actionColumnConfig = {
          label: this.translocoService.translate('toc.zoom-to'),
          icon: 'zoom-to-object',
          callback: (params: { feature: Graphic }): void => {
            this.service.zoomToFeature(params.feature);
          },
        };
      });
    });
  }

  protected onCellPointerOver(event: CustomEvent): void {
    const objectId = event.detail?.objectId;
    if (objectId != null) {
      this.service.highlightFeature(objectId, 'hover');
    }
  }

  protected onCellPointerOut(): void {
    this.service.clearHoverHighlight();
  }

  protected onSelectionChange(): void {
    const table = this.tableElement()?.nativeElement;
    if (!table) return;
    const objectIds = Array.from(table.highlightIds).filter((id): id is number => typeof id === 'number');
    this.service.highlightSelection(objectIds);
  }

  protected close(): void {
    this.service.closeTable();
  }
}
