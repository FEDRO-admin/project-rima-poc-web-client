import { Component, input, output } from '@angular/core';

export type DialogActionVariant = 'default' | 'primary' | 'destructive';

@Component({
  selector: 'rima-dialog-action',
  templateUrl: './dialog-action.component.html',
  styleUrl: './dialog-action.component.scss',
})
export class DialogActionComponent {
  readonly label = input.required<string>();
  readonly variant = input<DialogActionVariant>('default');
  readonly disabled = input<boolean>(false);

  readonly triggered = output<void>();
}
