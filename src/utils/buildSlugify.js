

//create a slug from a string
export const slugifyFunction = (name) =>{
    const slugify = (name) =>
      name
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    
    const buildUniqueSlug = (name) => `${slugify(name)}-${generateUniqueString(6)}`;
    return buildUniqueSlug(name);
}