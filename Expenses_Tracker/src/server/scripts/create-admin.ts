/**
 * Script to create an admin user
 * Usage: tsx src/server/scripts/create-admin.ts <email> <password>
 */

import { PrismaClient } from "@prisma/client";
import { hashPassword } from "~/server/utils/auth";
import { UserRole } from "~/server/utils/roles";

// Create a new Prisma client instance specifically for this script
const prisma = new PrismaClient();

async function createAdminUser(email: string, password: string) {
  try {
    console.log(`🔧 Creating admin user: ${email}`);

    // Check if user already exists using raw SQL
    const existingUsers = await prisma.$queryRaw`
      SELECT id, email, role FROM users WHERE email = ${email}
    `;

    if (Array.isArray(existingUsers) && existingUsers.length > 0) {
      const existingUser = existingUsers[0] as any;
      if (existingUser.role === UserRole.ADMIN) {
        console.log(`✅ User ${email} already exists and is an admin`);
        return;
      } else {
        // Update existing user to admin using raw SQL
        await prisma.$executeRaw`
          UPDATE users SET role = ${UserRole.ADMIN} WHERE email = ${email}
        `;
        console.log(`✅ Updated existing user ${email} to admin role`);
        return;
      }
    }

    // Create new admin user using raw SQL
    const hashedPassword = await hashPassword(password);
    await prisma.$executeRaw`
      INSERT INTO users (email, password, role, "createdAt") 
      VALUES (${email}, ${hashedPassword}, ${UserRole.ADMIN}, NOW())
    `;

    console.log(`✅ Created new admin user: ${email}`);
    console.log(`🔑 Admin user can now access the admin panel at /admin`);

  } catch (error) {
    console.error('❌ Failed to create admin user:', error);
    throw error;
  }
}

// Get command line arguments
const args = process.argv.slice(2);

if (args.length !== 2) {
  console.log('Usage: tsx src/server/scripts/create-admin.ts <email> <password>');
  console.log('Example: tsx src/server/scripts/create-admin.ts admin@example.com mypassword123');
  process.exit(1);
}

const [email, password] = args;

if (!email || !email.includes('@')) {
  console.error('❌ Invalid email format');
  process.exit(1);
}

if (!password || password.length < 6) {
  console.error('❌ Password must be at least 6 characters long');
  process.exit(1);
}

createAdminUser(email!, password!)
  .then(async () => {
    console.log('🎉 Admin user setup completed!');
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('❌ Script failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });