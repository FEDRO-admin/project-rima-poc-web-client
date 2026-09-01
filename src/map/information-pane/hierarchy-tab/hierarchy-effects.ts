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
          const result = await this.hierarchyService.buildHierarchyTree(graphic);
          if (result.tree) {
            this.store.setResult(result.tree, result.relatedParents);
          } else {
            this.store.setError('error.hierarchy.not-found');
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'error.hierarchy.load';
          this.store.setError(message);
        }
      });
    });
  }
}
