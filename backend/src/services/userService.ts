import { db } from "../db/connection";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";

export class UserService {
  async findByUsername(username: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    return user || null;
  }

  async createUser(username: string, passwordPlain: string, role: 'admin' | 'user') {
    const hashedPassword = await Bun.password.hash(passwordPlain, {
      algorithm: "bcrypt",
      cost: 10,
    });

    const [inserted] = await db
      .insert(users)
      .values({
        username,
        password: hashedPassword,
        role,
      })
      .returning();
    
    if (!inserted) {
      throw new Error(`Failed to create user: ${username}`);
    }
    
    return inserted;
  }

  async seedDefaultUsers() {
    const existingUsers = await db.select().from(users).limit(1);
    if (existingUsers.length === 0) {
      console.log("No users found in database. Seeding default admin and user...");
      
      const adminUser = await this.createUser("admin", "adminpassword", "admin");
      const standardUser = await this.createUser("user", "userpassword", "user");
      
      if (adminUser && standardUser) {
        console.log(`Default users seeded: 
- Username: ${adminUser.username} (role: ${adminUser.role})
- Username: ${standardUser.username} (role: ${standardUser.role})`);
      }
    } else {
      console.log("Database already has users. Skipping seeding.");
    }
  }
}
