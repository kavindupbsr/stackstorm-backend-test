const productService = require('../services/product.service');
const { successResponse, errorResponse } = require('../utils/responseFormatter');

/**
 * Controller for retrieving paginated product catalog with multi-faceted filtering.
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware
 */
const getProducts = async (req, res, next) => {
  try {
    const categoryParam =
      req.query.category_id || req.query.categoryId || req.query.category;
    const minPrice =
      req.query.min_price !== undefined ? req.query.min_price : req.query.minPrice;
    const maxPrice =
      req.query.max_price !== undefined ? req.query.max_price : req.query.maxPrice;
    const search = req.query.search || req.query.q || req.query.keyword;
    const {
      size,
      color,
      sort,
      page = 1,
      limit = 12,
      cursor,
    } = req.query;

    const result = await productService.listProducts({
      category: categoryParam,
      categoryId: categoryParam,
      minPrice,
      maxPrice,
      size,
      color,
      sort,
      search,
      page,
      limit,
      cursor,
    });

    return successResponse(
      res,
      {
        products: result.products,
        pagination: result.pagination,
      },
      'Products retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Controller for retrieving complete product details by slug.
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware
 */
const getProductBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const product = await productService.getProductBySlug(slug);

    if (!product) {
      return errorResponse(res, `Product not found: ${slug}`, [], 404);
    }

    return successResponse(res, product, 'Product details retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Controller for updating product details (Admin only) with cache eviction.
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware
 */
const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updated = await productService.updateProduct(id, req.body);
    return successResponse(res, updated, 'Product updated successfully', 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Controller for deleting a product (Admin only) with cache eviction.
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware
 */
const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    await productService.deleteProduct(id);
    return successResponse(res, null, 'Product deleted successfully', 200);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProducts,
  getProductBySlug,
  updateProduct,
  deleteProduct,
};
