export interface AccountSnapshot {
  balance: number
  owner: string
}

export class Account {
  private balance: number
  public readonly owner: string

  constructor(owner: string, openingBalance = 0) {
    this.owner = owner
    this.balance = openingBalance
  }

  deposit(amount: number): number {
    this.balance += amount
    return this.balance
  }

  withdraw(amount: number): number {
    this.balance -= amount
    return this.balance
  }

  snapshot(): AccountSnapshot {
    return { balance: this.balance, owner: this.owner }
  }
}
