import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('../map/map.component').then((m) => m.MapComponent),
  },
  {
    path: 'error',
    loadComponent: () =>
      import('../error-handling/fatal-error/fatal-error.component').then((m) => m.FatalErrorComponent),
  },
];
