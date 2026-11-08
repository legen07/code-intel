import { Account } from './account.ts'
import { applyInterest } from './utils.ts'
import { SqliteRepository } from './sqlite_repo.ts'

const repo = new SqliteRepository()
export async function openAccount(owner: string): Promise<Account> {
  const account = new Account(owner, 50)
  const grown = await applyInterest(account.snapshot().balance)
  account.deposit(grown - 50)
  await repo.save(account.snapshot())
  return account
}
