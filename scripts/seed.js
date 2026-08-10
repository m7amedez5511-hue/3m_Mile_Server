import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import Role from '../src/DB/models/role.model.js';
import User from '../src/DB/models/user.model.js';
import { buildFullPermissionSet } from '../src/constants/permissions.constant.js';

const run = async () => {
  //1. Connect to the database
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected for seeding.');
  //2. Create the Admin role if it doesn't exist, or reuse it if it does.
  const [adminRole] = await Role.find({ name: 'Admin' }).lean();
  const role =
    adminRole ||
    (await Role.create({
      name: 'Admin',
      permissions: buildFullPermissionSet(),
      isSystem: true,
    }));
    //3. Create the Admin user if it doesn't exist, or reuse it if it does.
  if (adminRole) {
    console.log('Admin role already exists — reusing it.');
  } else {
    console.log('Admin role created with full permission set.');
  }
  //4. Create the Admin user if it doesn't exist, or reuse it if it does.
  const email = process.env.SEED_ADMIN_EMAIL || 'super.admin@3m.mile.com';
  const existing = await User.findOne({ email });
  //5. If the admin user exists but has no role, attach the role to it.
  if (existing) {
    console.log(`Admin user already exists: ${email}`);
    // Edge case: admin exists but was somehow left without a role — repair it.
    if (!existing.role) {
      await User.updateOne({ _id: existing._id }, { role: role._id });
      console.log('Attached missing role to existing admin user.');
    }
  } else {
    //6. Create the admin user with a default password if it doesn't exist.
    const password = process.env.SEED_ADMIN_PASSWORD || '3mMile2026@';
    // Hash the password before saving it to the database.
    const hashed = await bcrypt.hash(password, 12);
    await User.create({
      fullName: 'Super Admin',
      email,
      password: hashed,
      role: role._id,
    });
    console.log(`Admin created: ${email} — CHANGE THIS PASSWORD IMMEDIATELY.`);
  }
//7. Disconnect from the database and exit the process.
  console.log('Seed complete: exactly one Admin role, exactly one admin user.');
  await mongoose.disconnect();
  process.exit(0);
};
// Run the seed script and handle any errors that occur during execution.
run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});