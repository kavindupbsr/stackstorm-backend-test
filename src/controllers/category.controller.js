const categoryService = require('../services/category.service');
const { successResponse } = require('../utils/responseFormatter');

/**
 * Handles retrieval of hierarchical category sub-tree.
 * Sets X-Cache: HIT or X-Cache: MISS header based on cache status.
 */
const getCategories = async (req, res, next) => {
  try {
    const tree = await categoryService.getCategoryTree();
    res.set('X-Cache', tree.fromCache ? 'HIT' : 'MISS');
    return successResponse(res, tree, 'Category hierarchy retrieved successfully');
  } catch (error) {
    return next(error);
  }
};

/**
 * Handles administrative category creation with automatic cache invalidation.
 */
const createCategory = async (req, res, next) => {
  try {
    const category = await categoryService.createCategory(req.body);
    return successResponse(res, category, 'Category created successfully', 201);
  } catch (error) {
    return next(error);
  }
};

/**
 * Handles administrative category update with automatic cache invalidation.
 */
const updateCategory = async (req, res, next) => {
  try {
    const category = await categoryService.updateCategory(req.params.id, req.body);
    return successResponse(res, category, 'Category updated successfully', 200);
  } catch (error) {
    return next(error);
  }
};

/**
 * Handles administrative category deletion with automatic cache invalidation.
 */
const deleteCategory = async (req, res, next) => {
  try {
    await categoryService.deleteCategory(req.params.id);
    return successResponse(res, null, 'Category deleted successfully', 200);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
