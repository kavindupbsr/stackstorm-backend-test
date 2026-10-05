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
    const {
      category_id: categoryId,
      min_price: minPrice,
      max_price: maxPrice,
      size,
      color,
      sort,
      search,
      page = 1,
      limit = 10,
      cursor,
    } = req.query;

    const result = await productService.listProducts({
      categoryId,
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
