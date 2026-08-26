import { asyncHandler } from '../middleware/errorHandler.js';
import { sendResponse } from '../utils/response.js';
import { getHomeContent, updateHomeContent } from '../services/homeContent.service.js';
import { getPromo, getActivePromo, updatePromo } from '../services/promo.service.js';
import { getOffersPage, updateOffersPage } from '../services/offersPage.service.js';
import { getBlogIntro, updateBlogIntro } from '../services/blogIntro.service.js';
import { getGalleryIntro, updateGalleryIntro } from '../services/galleryIntro.service.js';

/**
 * Handlers for the page-section singletons.
 *
 * Each is a read and a write over one document, so they are generated from a factory
 * rather than written out five times. The models and validators stay separate — only
 * this transport shim is shared.
 */
const singletonHandlers = (resource, read, write) => ({
  read: asyncHandler(async (req, res) => {
    const doc = await read();
    return sendResponse(res, 200, `${resource}_fetched`, doc);
  }),
  write: asyncHandler(async (req, res) => {
    const doc = await write(req);
    return sendResponse(res, 200, `${resource}_updated`, doc);
  }),
});

const home = singletonHandlers('home_content', getHomeContent, updateHomeContent);
export const getHome = home.read;
export const updateHome = home.write;

const offers = singletonHandlers('offers_page', getOffersPage, updateOffersPage);
export const getOffersPageContent = offers.read;
export const updateOffersPageContent = offers.write;

const blog = singletonHandlers('blog_intro', getBlogIntro, updateBlogIntro);
export const getBlogIntroContent = blog.read;
export const updateBlogIntroContent = blog.write;

const gallery = singletonHandlers('gallery_intro', getGalleryIntro, updateGalleryIntro);
export const getGalleryIntroContent = gallery.read;
export const updateGalleryIntroContent = gallery.write;

const promo = singletonHandlers('promo', getPromo, updatePromo);
export const updatePromoContent = promo.write;

/**
 * Public promo read — deliberately NOT the factory's version.
 *
 * Returns null when the campaign is switched off, so the frontend renders no modal at
 * all. Handing the raw document to the public site instead would leak the artwork of a
 * retired campaign to anyone reading the response.
 */
export const getPromoContent = asyncHandler(async (req, res) => {
  const promoDoc = await getActivePromo();
  return sendResponse(res, 200, 'promo_fetched', promoDoc);
});

/** Admin promo read — includes retired campaigns so they can be edited and re-enabled. */
export const getPromoAdmin = asyncHandler(async (req, res) => {
  const promoDoc = await getPromo();
  return sendResponse(res, 200, 'promo_fetched', promoDoc);
});
