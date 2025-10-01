import { eq } from "drizzle-orm";
import { db } from "../db";
import { users, type InsertUser, type User } from "@shared/schema";

type Database = typeof db;

export interface UsersRepository {
  findById(id: string): Promise<User | undefined>;
  findByUsername(username: string): Promise<User | undefined>;
  create(user: InsertUser): Promise<User>;
}

export class DrizzleUsersRepository implements UsersRepository {
  constructor(private readonly database: Database) {}

  async findById(id: string): Promise<User | undefined> {
    const [user] = await this.database
      .select()
      .from(users)
      .where(eq(users.id, id));

    return user;
  }

  async findByUsername(username: string): Promise<User | undefined> {
    const [user] = await this.database
      .select()
      .from(users)
      .where(eq(users.username, username));

    return user;
  }

  async create(user: InsertUser): Promise<User> {
    const [created] = await this.database
      .insert(users)
      .values(user)
      .returning();

    return created;
  }
}

export function createUsersRepository(database: Database = db): UsersRepository {
  return new DrizzleUsersRepository(database);
}
