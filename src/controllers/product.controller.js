const productService = require('../services/product.service');
const { successResponse } = require('../utils/responseFormatter');

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

module.exports = {
  getProducts,
};
