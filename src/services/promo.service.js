import { singletonService } from './singleton.service.js';

/** The timed promotional overlay — one document, toggled rather than deleted. */
const base = singletonService('Promo', {
  updatableFields: ['alt', 'width', 'height', 'whatsappText', 'delayMs', 'isActive'],
  imageSlots: {
    image: { urlField: 'image', publicIdField: 'imagePublicId' },
  },
});

/** Admin read — always returns the document, including a retired campaign. */
export const getPromo = base.get;

export const updatePromo = base.update;

/**
 * Public read. Returns null when the campaign is off or has no artwork, so the frontend
 * simply does not render the modal rather than showing an empty overlay.
 */
export const getActivePromo = async () => {
  const promo = await base.get();
  if (!promo?.isActive || !promo.image) return null;
  return promo;
};
