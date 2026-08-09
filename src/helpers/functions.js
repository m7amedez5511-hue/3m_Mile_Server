
import fs from 'fs/promises';
import path from 'path';


const toCamelCase = (str) => {
    if (!str || typeof str !== 'string') return str;
    return str
        .replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '')
        .replace(/^(.)/, (c) => c.toLowerCase());
};

module.exports = {
    capitalize: (str) => {
        if (!str) return "";
        return str.charAt(0).toUpperCase() + str.slice(1);
    },
    hasRequiredParams: (body, params = []) => {
        return params.every(key => body[key] !== undefined && body[key] !== null && body[key].length !== 0);
    },
    requiredFields: (body, params = []) => {
        const missing = params.filter(field => !(field in body) || body[field] === undefined || body[field] === null);

        // Optional: for array fields, check if empty
        const emptyArrays = params
            .filter(field => Array.isArray(body[field]) && body[field].length === 0);

        return [...missing, ...emptyArrays];
    },
    chunkArray: (array, size) => {
        const result = [];
        for (let i = 0; i < array.length; i += size) {
            result.push(array.slice(i, i + size));
        }
        return result;
    },
    getParamsForDeepLink: (app, screenKey) => {
        const { PET_OWNER_DEEP_LINKS, PSP_DEEP_LINKS } = require('../constants/deep-links.constant');
        const deepLinks = app === 'psp' ? PSP_DEEP_LINKS : PET_OWNER_DEEP_LINKS;
        const entry = deepLinks[screenKey];
        if (!entry) return null;
        return entry.params;
    },
    normalizeVersion: (version) => {
        if (!version) return null;
        const parts = version.split('.');
        while (parts.length < 3) parts.push('0'); // ensure x.y.z format
        return parts.map(p => p.padStart(3, '0')).join('.');
    },
    normalizeAuthData: (input) => {
        let user, employee, rawRoles;

        // ✅ CASE 1: employee is root (employee.user exists)
        if (input?.user) {
            employee = input;
            user = input.user;
            rawRoles = user.roles || [];
        }

        // ✅ CASE 2: user is root (user.employee exists)
        else {
            user = input;
            employee = input.employee;
            rawRoles = input.roles || [];
        }

        // ✅ Ensure safety
        rawRoles = Array.isArray(rawRoles) ? rawRoles : [];

        // ✅ Build modules properly
        const modulesMap = new Map();

        rawRoles.forEach(role => {
            role.permissions?.forEach(permission => {
                const module = permission.module;
                if (!module?._id) return;

                const moduleId = String(module._id);

                if (!modulesMap.has(moduleId)) {
                    modulesMap.set(moduleId, {
                        _id: module._id,
                        name: module.name,
                        displayName: module.displayName,
                        description: module.description,
                        permissions: []
                    });
                }

                modulesMap.get(moduleId).permissions.push({
                    _id: permission._id,
                    name: permission.name,
                    action: permission.action,
                    description: permission.description
                });
            });
        });

        const modules = Array.from(modulesMap.values());

        // ✅ Clean roles (remove permissions + rolePermissions)
        const roles = rawRoles.map(({ permissions, rolePermissions, ...cleanRole }) => cleanRole);

        // ✅ Clean user completely
        const {
            roles: _r,
            useRoles: _ur,
            password,
            ...cleanUser
        } = user;

        // ✅ Clean employee from circular user if exists
        if (employee?.user) delete employee.user;
        if (cleanUser?.employee) delete cleanUser.employee;

        return {
            user: cleanUser,   // ✅ NO roles / NO useRoles
            employee,          // ✅ Clean
            roles,             // ✅ NO permissions inside
            modules            // ✅ permissions grouped here
        };
    },
    normalizeEmployeesData: (input) => {
        let user, employee, rawRoles;

        // ✅ CASE 1: employee is root (employee.user exists)
        if (input?.user) {
            employee = input;
            user = input.user;
            rawRoles = user.roles || [];
        }

        // ✅ CASE 2: user is root (user.employee exists)
        else {
            user = input;
            employee = input.employee;
            rawRoles = input.roles || [];
        }

        // ✅ Ensure safety
        rawRoles = Array.isArray(rawRoles) ? rawRoles : [];
        // ✅ Build modules per role properly
        rawRoles.forEach(role => {
            const roleModules = new Map();
            role.permissions?.forEach(permission => {
                const module = permission.module;
                if (!module?._id) return;

                const moduleId = String(module._id);

                if (!roleModules.has(moduleId)) {
                    roleModules.set(moduleId, {
                        _id: module._id,
                        name: module.name,
                        displayName: module.displayName,
                        description: module.description,
                        permissions: []
                    });
                }

                roleModules.get(moduleId).permissions.push({
                    _id: permission._id,
                    name: permission.name,
                    action: permission.action,
                    description: permission.description
                });
            });

            role.modules = Array.from(roleModules.values());
        });


        // ✅ Clean roles (remove permissions + rolePermissions)
        const roles = rawRoles.map(({ permissions, rolePermissions, ...cleanRole }) => cleanRole);

        // ✅ Clean user completely
        const {
            roles: _r,
            useRoles: _ur,
            password,
            ...cleanUser
        } = user;

        // ✅ Clean employee from circular user if exists
        if (employee?.user) delete employee.user;
        if (cleanUser?.employee) delete cleanUser.employee;

        return {
            employee: {
                ...employee,
                user: cleanUser,
                roles
            },
        };
    },
    writeTempJSONFile: async (data, prefix = 'temp') => {
        const logsDir = path.join(__dirname, '../logs/transactions');
        await fs.mkdir(logsDir, { recursive: true });
        const filename = path.join(logsDir, `${prefix}-${Date.now()}.json`);
        await fs.writeFile(filename, JSON.stringify(data, null, 2));
        return filename;
    },

    getNanoid: async (length) => {
        const { customAlphabet } = await import('nanoid');
        const nanoidNumbers = customAlphabet('0123456789', length);
        return nanoidNumbers();
    },
    normalizeToCamelCase: (sections) => {
        if (!sections) return null;
        return Object.fromEntries(
            Object.entries(sections).map(([k, items]) => [
                toCamelCase(k),
                items.map(item => ({ key: toCamelCase(item.key), value: item.value }))
            ])
        );
    },
}