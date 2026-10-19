import dataSource from '../common/database/data-source';
import { AppUser } from '../modules/identity/entities/app-user.entity';
import { EUserStatus } from '@contractflow/contracts-schema';

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();

  if (!email) {
    console.error('Usage: pnpm admin:promote <user-email>');
    process.exit(1);
  }

  console.log(`Connecting to database to provision platform admin for: ${email}...`);
  await dataSource.initialize();

  try {
    const userRepository = dataSource.getRepository(AppUser);
    const user = await userRepository.findOne({
      where: { email },
    });

    if (!user) {
      console.error(`Error: User with email "${email}" was not found.`);
      process.exit(1);
    }

    if (user.status !== EUserStatus.ACTIVE) {
      console.error(
        `Error: Cannot promote user with status "${user.status}". User must be ACTIVE.`,
      );
      process.exit(1);
    }

    if (user.isPlatformAdmin) {
      console.log(`User "${email}" is already a platform administrator.`);
      process.exit(0);
    }

    user.isPlatformAdmin = true;
    await userRepository.save(user);

    console.log(`Success: User "${email}" (ID: ${user.id}) has been promoted to Platform Administrator.`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error('Failed to promote user to platform admin:', error);
  process.exit(1);
});
