import { checkPassword, hashPassword } from '../helpers/passwords';
import { User } from '../types/index';
export class UsersStore {
  private static instance: UsersStore;
  private users: User[] = [];
  public static getInstance(): UsersStore {
    if (!UsersStore.instance) {
      UsersStore.instance = new UsersStore();
    }
    return UsersStore.instance;
  }

  public async addUser(name: string, password: string, connectionId: string): Promise<User | null> {
    if (this.users.find((user) => user.name === name)) {
      return null;
    }
    const hash = await hashPassword(password);
    const newUser: User = {
      name,
      hash,
      index: connectionId,
      wins: 0,
      isLogin: true,
    };

    this.users.push(newUser);
    return newUser;
  }

  public addBot(botId: string): User {
    const botUser: User = {
      name: 'BOT',
      hash: 'BOT_HASH',
      index: botId,
      wins: 0,
      isLogin: true,
    };

    this.users.push(botUser);
    return botUser;
  }
  
  public async validateUser(name: string, password: string): Promise<User | null> {
    const user = this.users.find((u) => u.name === name);
    if (!user) {
      return null;
    }
    const isValid = await checkPassword(password, user.hash);
    return isValid ? user : null;
  }
  public getAllUsers(): User[] {
    return this.users;
  }
  public getUserByName(name: string): User | null {
    return this.users.find((u) => u.name === name) || null;
  }

  public getUserById(connectionId: string): User | null {
    return this.users.find((user) => user.index === connectionId) || null;
  }

  public updateUser(connectionId: string, updatedUser: User): User | null {
    const index = this.users.findIndex((user) => user.index === connectionId);
    if (index !== -1) {
      this.users[index] = updatedUser;
      return this.users[index];
    }
    return null;
  }
  public updateWins(connectionId: string): void {
    const user = this.users.find((user) => user.index === connectionId);
    if (user) {
      user.wins++;
    }
  }

  public isAlreadyLogin(name: string): boolean {
    return this.users.some((user) => user.name === name && user.isLogin);
  }
}
