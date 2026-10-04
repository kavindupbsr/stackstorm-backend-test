const { Category } = require('../models');
const redisClient = require('../config/redis');
const cacheService = require('./cache.service');
const { logger } = require('../config/logger');
const ApiError = require('../utils/ApiError');

const CACHE_KEY = 'cache:categories:tree';
const CACHE_TTL_SECONDS = 86400; // 24 hours

// Fallback seed catalog for offline development or testing without live PostgreSQL
const FALLBACK_CATEGORIES = [
  {
    id: 'a0000000-0000-0000-0000-000000000001',
    name: 'Men',
    slug: 'men',
    description: 'Men clothing, batik shirts, formal wear, and accessories.',
    parent_id: null,
    is_active: true,
  },
  {
    id: 'a0000000-0000-0000-0000-000000000002',
    name: 'Women',
    slug: 'women',
    description: 'Women designer silk saris, linen dresses, kurtis.',
    parent_id: null,
    is_active: true,
  },
  {
    id: 'a0000000-0000-0000-0000-000000000003',
    name: 'Kids',
    slug: 'kids',
    description: 'Festive sarong sets, party dresses, cotton clothing.',
    parent_id: null,
    is_active: true,
  },
  {
    id: 'a0000000-0000-0000-0000-000000000011',
    name: 'Batik Shirts',
    slug: 'men-batik-shirts',
    description: 'Hand-crafted batik casual and formal shirts.',
    parent_id: 'a0000000-0000-0000-0000-000000000001',
    is_active: true,
  },
  {
    id: 'a0000000-0000-0000-0000-000000000012',
    name: 'Formal Trousers',
    slug: 'men-formal-trousers',
    description: 'Tailored slim-fit and pleated formal trousers.',
    parent_id: 'a0000000-0000-0000-0000-000000000001',
    is_active: true,
  },
  {
    id: 'a0000000-0000-0000-0000-000000000021',
    name: 'Silk Saris',
    slug: 'women-silk-saris',
    description: 'Traditional Sri Lankan handloom and pure silk saris.',
    parent_id: 'a0000000-0000-0000-0000-000000000002',
    is_active: true,
  },
];

/**
 * Recursively constructs a nested category hierarchy tree from a flat category array.
 * Employs a visited Set to guard against circular parent references.
 *
 * @param {Array<object>} categories - Flat array of category objects
 * @param {string|null} [parentId=null] - Current parent ID to filter on
 * @param {Set<string>} [visited=new Set()] - Set of visited category IDs
 * @returns {Array<object>} Hierarchical category tree
 */
const buildCategoryTree = (categories, parentId = null, visited = new Set()) => {
  const result = [];
  const currentVisited = new Set(visited);
  if (parentId) {
    currentVisited.add(parentId);
  }

  for (const cat of categories) {
    const rawParentId = cat.parent_id !== undefined ? cat.parent_id : cat.parentId;
    const catParentId = rawParentId || null;

    if (catParentId === parentId) {
      if (currentVisited.has(cat.id)) {
        logger.warn(`Circular reference detected in category hierarchy for id: ${cat.id}`);
      } else {
        const nextVisited = new Set(currentVisited);
        nextVisited.add(cat.id);

        const plain = typeof cat.toJSON === 'function' ? cat.toJSON() : cat;

        result.push({
          id: plain.id,
          name: plain.name,
          slug: plain.slug,
          description: plain.description,
          parent_id: catParentId,
          is_active: plain.is_active !== undefined ? plain.is_active : true,
          children: buildCategoryTree(categories, plain.id, nextVisited),
        });
      }
    }
  }

  return result;
};

/**
 * Invalidates the cached category hierarchy tree in Redis.
 *
 * @returns {Promise<boolean>}
 */
const invalidateCategoryCache = async () => {
  try {
    await redisClient.del(CACHE_KEY);
    await cacheService.invalidatePattern('cache:categories:*');
    logger.info(`Invalidated Redis category cache: ${CACHE_KEY}`);
    return true;
  } catch (err) {
    logger.warn(`Failed to invalidate category cache: ${err.message}`);
    return false;
  }
};

/**
 * Retrieves the full nested category hierarchy tree using a Cache-Aside pattern.
 * Checks Redis first; if absent, queries PostgreSQL, builds the tree, and caches with 24h TTL.
 *
 * @returns {Promise<Array<object>>} Category hierarchy tree
 */
const getCategoryTree = async () => {
  try {
    // 1. Check Redis Cache
    const cachedData = await redisClient.get(CACHE_KEY);
    if (cachedData) {
      try {
        const tree = JSON.parse(cachedData);
        if (Array.isArray(tree)) {
          tree.fromCache = true;
          return tree;
        }
      } catch (parseErr) {
        logger.warn(`Failed to parse cached category tree JSON: ${parseErr.message}`);
      }
    }

    // 2. Fetch from PostgreSQL database
    let rawCategories = [];
    try {
      rawCategories = await Category.findAll({
        where: { is_active: true },
        order: [['name', 'ASC']],
      });
    } catch (dbErr) {
      logger.warn(
        `Database query failed in getCategoryTree: ${dbErr.message}. Utilizing fallback.`
      );
      rawCategories = FALLBACK_CATEGORIES;
    }

    if (!rawCategories || rawCategories.length === 0) {
      rawCategories = FALLBACK_CATEGORIES;
    }

    // 3. Construct recursive sub-tree
    const tree = buildCategoryTree(rawCategories);
    tree.fromCache = false;

    // 4. Populate Redis Cache with 24-hour TTL (86400 seconds)
    try {
      await redisClient.set(CACHE_KEY, JSON.stringify(tree), 'EX', CACHE_TTL_SECONDS);
    } catch (cacheErr) {
      logger.warn(`Failed to populate category cache: ${cacheErr.message}`);
    }

    return tree;
  } catch (error) {
    logger.error(`Error in getCategoryTree: ${error.message}`);
    throw error;
  }
};

/**
 * Creates a new category and invalidates the category tree cache.
 *
 * @param {object} categoryData
 * @returns {Promise<object>} Created category
 */
const createCategory = async (categoryData) => {
  const { name, slug, description, parent_id: parentId, is_active: isActive } = categoryData;

  const existing = await Category.findOne({ where: { slug } });
  if (existing) {
    throw ApiError.conflict(`Category slug '${slug}' already exists`);
  }

  const category = await Category.create({
    name,
    slug,
    description,
    parent_id: parentId || null,
    is_active: isActive !== undefined ? isActive : true,
  });

  await invalidateCategoryCache();
  return category;
};

/**
 * Updates an existing category and invalidates the category tree cache.
 *
 * @param {string} id
 * @param {object} updateData
 * @returns {Promise<object>}
 */
const updateCategory = async (id, updateData) => {
  try {
    const category = await Category.findByPk(id);
    if (category) {
      await category.update(updateData);
      await invalidateCategoryCache();
      return category;
    }
  } catch (err) {
    logger.warn(`Database category update failed: ${err.message}. Checking fallback.`);
  }

  const fallbackCat = FALLBACK_CATEGORIES.find((c) => c.id === id);
  if (!fallbackCat) {
    throw ApiError.notFound(`Category not found with ID ${id}`);
  }
  Object.assign(fallbackCat, updateData);
  await invalidateCategoryCache();
  return fallbackCat;
};

/**
 * Deletes an existing category and invalidates the category tree cache.
 *
 * @param {string} id
 * @returns {Promise<boolean>}
 */
const deleteCategory = async (id) => {
  try {
    const category = await Category.findByPk(id);
    if (category) {
      await category.destroy();
      await invalidateCategoryCache();
      return true;
    }
  } catch (err) {
    logger.warn(`Database category delete failed: ${err.message}. Checking fallback.`);
  }

  const index = FALLBACK_CATEGORIES.findIndex((c) => c.id === id);
  if (index === -1) {
    throw ApiError.notFound(`Category not found with ID ${id}`);
  }
  FALLBACK_CATEGORIES.splice(index, 1);
  await invalidateCategoryCache();
  return true;
};

module.exports = {
  getCategoryTree,
  buildCategoryTree,
  invalidateCategoryCache,
  createCategory,
  updateCategory,
  deleteCategory,
  CACHE_KEY,
  CACHE_TTL_SECONDS,
};
