
/**
 * Full permission set. The single "Admin" (System Administrator) role
 * is always granted every permission in this list — there is no
 * partial-permission role in this system.
 */
export const PERMISSIONS = [
  { slug: 'user:write', name: 'Manage users' },
  { slug: 'user:delete', name: 'Delete users' },
  { slug: 'role:write', name: 'Manage roles' },
  { slug: 'role:delete', name: 'Delete roles' },
  { slug: 'category:write', name: 'Manage categories' },
  { slug: 'category:delete', name: 'Delete categories' },
  { slug: 'product:write', name: 'Manage products' },
  { slug: 'product:delete', name: 'Delete products' },
  { slug: 'service:write', name: 'Manage services' },
  { slug: 'service:delete', name: 'Delete services' },
  { slug: 'branch:write', name: 'Manage branches' },
  { slug: 'branch:delete', name: 'Delete branches' },
  { slug: 'blogPost:write', name: 'Manage blog posts' },
  { slug: 'blogPost:delete', name: 'Delete blog posts' },
  { slug: 'package:write', name: 'Manage packages' },
  { slug: 'package:delete', name: 'Delete packages' },
  { slug: 'gallery:write', name: 'Manage gallery' },
  { slug: 'gallery:delete', name: 'Delete gallery' },
  { slug: 'partner:write', name: 'Manage partners' },
  { slug: 'partner:delete', name: 'Delete partners' },
  { slug: 'faq:write', name: 'Manage FAQs' },
  { slug: 'faq:delete', name: 'Delete FAQs' },
  { slug: 'siteSetting:write', name: 'Manage site settings' },
  { slug: 'siteSetting:delete', name: 'Delete site settings' },
  { slug: 'audit:read', name: 'Read audit logs' },
];

export const buildFullPermissionSet = () =>
  PERMISSIONS.map(({ slug, name }) => ({ permission: { slug, name } }));