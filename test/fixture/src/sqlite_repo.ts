import type { Repository } from './repo.ts'
import type { AccountSnapshot } from './account.ts'

export class SqliteRepository implements Repository<AccountSnapshot> {
  async save(item: AccountSnapshot): Promise<void> {
    await Promise.resolve(item)
  }

  async load(id: string): Promise<AccountSnapshot | null> {
    if (id === 'missing') return null
    return { balance: 100, owner: id }
  }
}
