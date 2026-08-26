import { singletonService } from './singleton.service.js';

/**
 * Banner and copy for the offers page. The offer *cards* are Package documents — the
 * admin adds and removes those independently of this page's own heading.
 */
const base = singletonService('OffersPage', {
  updatableFields: ['bannerAlt', 'intro', 'formHeading', 'formSubheading'],
  imageSlots: {
    banner: { urlField: 'banner', publicIdField: 'bannerPublicId' },
  },
});

export const getOffersPage = base.get;
export const updateOffersPage = base.update;
