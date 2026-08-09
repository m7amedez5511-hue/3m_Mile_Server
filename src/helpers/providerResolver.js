
import crudService from '../services/crud.service.js';
import { DATABASE_COLLECTIONS, DATABASE_MODELS } from '../constants/models.constants.js';


const providers = {
    jahez: {
        collections: {
            driver: DATABASE_COLLECTIONS.JAHEZ.DRIVER,
            renter: DATABASE_COLLECTIONS.JAHEZ.RENTER,
            ledger: DATABASE_COLLECTIONS.JAHEZ.DRIVER_LEDGER,
        },
        models: {
            driver: DATABASE_MODELS.JAHEZ.DRIVER,
            renter: DATABASE_MODELS.JAHEZ.RENTER,
            ledger: DATABASE_MODELS.JAHEZ.DRIVER_LEDGER,
        },
    },
    hunger: {
        collections: {
            driver: DATABASE_COLLECTIONS.HUNGER.DRIVER,
            renter: DATABASE_COLLECTIONS.HUNGER.RENTER,
            ledger: DATABASE_COLLECTIONS.HUNGER.DRIVER_LEDGER,
        },
        models: {
            driver: DATABASE_MODELS.HUNGER.DRIVER,
            renter: DATABASE_MODELS.HUNGER.RENTER,
            ledger: DATABASE_MODELS.HUNGER.DRIVER_LEDGER,
        },
    },
};

const resolve = (provider) => {
    const p = providers[provider];
    if (!p) throw new Error(`Unknown provider: ${provider}`);
    return p;
};

module.exports = {
    getProviderCollection: (provider, entity) => resolve(provider).collections[entity],
    getProviderCrud: (provider, entity) => crudService(resolve(provider).models[entity]),
};
