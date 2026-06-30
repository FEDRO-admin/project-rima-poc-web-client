import { effect, inject, Injectable, untracked } from '@angular/core';
import { HierarchyStore } from './hierarchy.store';
import { HierarchyService } from './hierarchy.service';

@Injectable({
  providedIn: 'root',
})
export class HierarchyEffects {
  private readonly store = inject(HierarchyStore);
  private readonly hierarchyService = inject(HierarchyService);

  constructor() {
    this.loadHierarchyOnGraphicChange();
  }

  private loadHierarchyOnGraphicChange(): void {
    effect(() => {
      const graphic = this.store.graphic();
      untracked(async () => {
        if (!graphic) return;

        this.store.setLoading();

        try {
          const tree = await this.hierarchyService.buildHierarchyTree(graphic);
          if (tree) {
            this.store.setTree(tree);
          } else {
            this.store.setError('No hierarchy found');
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to load hierarchy';
          this.store.setError(message);
        }
      });
    });
  }
}
