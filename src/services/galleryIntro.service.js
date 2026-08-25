import { singletonService } from './singleton.service.js';

/** Headings above the two work galleries. Text only — the items live in GalleryItem. */
const base = singletonService('GalleryIntro', {
  updatableFields: [
    'video.heading', 'video.description',
    'photo.heading', 'photo.description',
  ],
});

export const getGalleryIntro = base.get;
export const updateGalleryIntro = base.update;
