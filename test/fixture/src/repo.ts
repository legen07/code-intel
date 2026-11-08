export interface Repository<T> {
  save(item: T): Promise<void>
  load(id: string): Promise<T | null>
}
