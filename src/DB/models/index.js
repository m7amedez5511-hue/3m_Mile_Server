
// Central model registry — importing this file (for its side effects)
// registers every Mongoose model, regardless of which service/route
// actually references it. Prevents "Schema hasn't been registered for
// model X" errors when a model is only referenced indirectly via
// populate() and never imported directly elsewhere.
import './user.model.js';
import './role.model.js';
import './category.model.js';
import './service.model.js';
import './product.model.js';
import './branch.model.js';
import './blogPost.model.js';
import './package.model.js';
import './galleryItem.model.js';
import './partner.model.js';
import './faq.model.js';
import './siteSetting.model.js';
import './auditLog.model.js';