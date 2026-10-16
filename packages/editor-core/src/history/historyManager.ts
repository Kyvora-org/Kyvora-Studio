/**
 * Gestor de Historial Deshacer/Rehacer (Undo / Redo) con límites de memoria
 */
export interface HistoryOptions {
  maxDepth?: number;
}

export class HistoryManager<T> {
  private past: T[] = [];
  private present: T;
  private future: T[] = [];
  private maxDepth: number;

  constructor(initialState: T, options?: HistoryOptions) {
    this.present = initialState;
    this.maxDepth = options?.maxDepth ?? 50;
  }

  public getState(): T {
    return this.present;
  }

  public push(newState: T): void {
    // Si el estado es referencialmente idéntico, no generar entrada de historial redundante
    if (this.present === newState) return;

    this.past.push(this.present);

    // Respetar el límite de memoria configurado
    if (this.past.length > this.maxDepth) {
      this.past.shift();
    }

    this.present = newState;
    // Cada nueva acción invalida la rama futura
    this.future = [];
  }

  public canUndo(): boolean {
    return this.past.length > 0;
  }

  public canRedo(): boolean {
    return this.future.length > 0;
  }

  public undo(): T | null {
    if (!this.canUndo()) return null;

    const previous = this.past.pop()!;
    this.future.unshift(this.present);
    this.present = previous;
    return this.present;
  }

  public redo(): T | null {
    if (!this.canRedo()) return null;

    const next = this.future.shift()!;
    this.past.push(this.present);
    this.present = next;
    return this.present;
  }

  public clear(resetState?: T): void {
    this.past = [];
    this.future = [];
    if (resetState !== undefined) {
      this.present = resetState;
    }
  }

  public getDepth(): { pastCount: number; futureCount: number; maxDepth: number } {
    return {
      pastCount: this.past.length,
      futureCount: this.future.length,
      maxDepth: this.maxDepth
    };
  }
}
