import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@gddsn.com';
  const password = 'admin123';
  const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

  const existingAgent = await prisma.agent.findUnique({ where: { email } });
  
  if (existingAgent) {
    console.log('✅ Admin user already exists');
    console.log(`📧 Email: ${email}`);
    return;
  }

  const agent = await prisma.agent.create({
    data: {
      name: 'Admin',
      email,
      phone: '+966500000000',
      passwordHash,
      role: 'ADMIN',
      isOnline: false,
      maxConcurrentChats: 10,
    },
  });

  console.log('✅ Admin user created successfully!');
  console.log('📧 Email:', email);
  console.log('🔑 Password:', password);
  console.log('👤 Agent ID:', agent.id);
}

main()
  .catch((e) => {
    console.error('❌ Error creating admin user:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
