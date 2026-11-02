import { Component, EventEmitter, Output, signal } from '@angular/core';

@Component({
  imports: [],
  selector: 'app-load-archipelago',
  styleUrl: './load-archipelago.css',
  templateUrl: './load-archipelago.html',
})
export class LoadArchipelago {
@Output() loadRequested = new EventEmitter<void>();

  readonly isLoading = signal(false);

  async onLoadClick(): Promise<void> {
    if (this.isLoading()) {
      return;
    }

    this.isLoading.set(true);

    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 500));
      this.loadRequested.emit();
    } finally {
      this.isLoading.set(false);
    }
  }

}
