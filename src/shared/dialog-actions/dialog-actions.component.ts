import { Component, input } from '@angular/core';

@Component({
  selector: 'rima-dialog-actions',
  templateUrl: './dialog-actions.component.html',
  styleUrl: './dialog-actions.component.scss',
})
export class DialogActionsComponent {
  readonly message = input<string>();
}
