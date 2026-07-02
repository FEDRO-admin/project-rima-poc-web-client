import { computed, inject, Injectable } from '@angular/core';
import { DeleteStore } from './delete.store';

@Injectable({
  providedIn: 'root',
})
export class DeleteEffects {
  private readonly deleteStore = inject(DeleteStore);

  readonly deleting = computed(() => this.deleteStore.active());
}
