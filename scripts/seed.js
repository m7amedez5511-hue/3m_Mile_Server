// scripts/seed.js
// Run with: node scripts/seed.js
// Purpose: idempotent seed for local/dev/staging — creates the "Admin" role
// and one admin user so you can log in and start managing the system.
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import Role from '../src/DB/models/role.model.js';
import User from '../src/DB/models/user.model.js';

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected for seeding.');

  const [adminRole] = await Role.find({ name: 'Admin' }).lean();
  const role =
    adminRole ||
    (await Role.create({
      name: 'Admin',
      permissions: [
        
        //product permissions
        { permission: { slug: 'product:write', name: 'Manage products' } },
        { permission: { slug: 'product:delete', name: 'Delete products' } },
        //audit permissions
        { permission: { slug: 'audit:read', name: 'Read audit logs' } },
        //category permissions
        { permission: { slug: 'category:write', name: 'Manage categories' } },
        { permission: { slug: 'category:delete', name: 'Delete categories' } },
        //role permissions
        { permission: { slug: 'role:write', name: 'Manage roles' } },
        { permission: { slug: 'role:delete', name: 'Delete roles' } },
        //blogPost permissions
        { permission: { slug: 'blogPost:write', name: 'Manage blog posts' } },
        { permission: { slug: 'blogPost:delete', name: 'Delete blog posts' } },
        //branch permissions
        { permission: { slug: 'branch:write', name: 'Manage branches' } },
        { permission: { slug: 'branch:delete', name: 'Delete branches' } },
        //service permissions
        { permission: { slug: 'service:write', name: 'Manage services' } },
        { permission: { slug: 'service:delete', name: 'Delete services' } },
        //faq permissions
        { permission: { slug: 'faq:write', name: 'Manage FAQs' } },
        { permission: { slug: 'faq:delete', name: 'Delete FAQs' } },
        //gallery permissions
        { permission: { slug: 'gallery:write', name: 'Manage gallery' } },
        { permission: { slug: 'gallery:delete', name: 'Delete gallery' } },
        //package permissions
        { permission: { slug: 'package:write', name: 'Manage packages' } },
        { permission: { slug: 'package:delete', name: 'Delete packages' } },
        //partner permissions
        { permission: { slug: 'partner:write', name: 'Manage partners' } },
        { permission: { slug: 'partner:delete', name: 'Delete partners' } },
        //product permissions
        { permission: { slug: 'product:write', name: 'Manage products' } },
        { permission: { slug: 'product:delete', name: 'Delete products' } },
        //siteSetting permissions
        { permission: { slug: 'siteSetting:write', name: 'Manage site settings' } },
        { permission: { slug: 'siteSetting:delete', name: 'Delete site settings' } },
        //user permissions
        { permission: { slug: 'user:write', name: 'Manage users' } },
        { permission: { slug: 'user:delete', name: 'Delete users' } },
      ],
    }));

  const email = process.env.SEED_ADMIN_EMAIL || 'super.admin@3m.mile.com';
  const existing = await User.findOne({ email });

  if (existing) {
    console.log(`Admin user already exists: ${email}`);
  } else {
    const password = process.env.SEED_ADMIN_PASSWORD || '3mMile2026@';
    const hashed = await bcrypt.hash(password, 12);
    await User.create({
      fullName: 'Super Admin',
      email,
      password: hashed,
      role: role._id,
    });
    console.log(`Admin created: ${email} / ${password} — CHANGE THIS PASSWORD IMMEDIATELY.`);
  }

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});