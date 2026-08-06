import { Component, CUSTOM_ELEMENTS_SCHEMA, input, output } from '@angular/core';
import '@esri/calcite-components/dist/components/calcite-icon';

@Component({
  selector: 'rima-action-bar-button',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './action-bar-button.component.html',
  styleUrl: './action-bar-button.component.scss',
})
export class ActionBarButtonComponent {
  readonly icon = input.required<string>();
  readonly label = input<string>();
  readonly variant = input<'default' | 'destructive' | 'primary'>('default');
  readonly disabled = input(false);

  readonly triggered = output<void>();
}
