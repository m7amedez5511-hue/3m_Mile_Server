import { singletonService } from './singleton.service.js';

/** Banner above the article grid on the blog index. */
const base = singletonService('BlogIntro', {
  updatableFields: ['heading', 'description', 'imageAlt'],
  imageSlots: {
    image: { urlField: 'image', publicIdField: 'imagePublicId' },
  },
});

export const getBlogIntro = base.get;
export const updateBlogIntro = base.update;
