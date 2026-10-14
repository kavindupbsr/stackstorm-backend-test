# StackStorm E-Commerce Platform — API Audit & Incident Resolution Report

**Repository:** `stackstorm-backend` & `stackstorm-frontend-customer`  
**Date:** October 14, 2026  
**Status:** Completed & Verified  

---

## 1. Executive Summary

During system verification of the StackStorm E-Commerce Platform REST APIs via the Postman collection ([StackStorm_Postman_Collection.json](file:///c:/Users/ASUS%20TUF/Desktop/Design%20project/stackstorm-backend/StackStorm_Postman_Collection.json)) and customer frontend integration, several issues were diagnosed, resolved, and verified:

1. **Docker Infrastructure Outage**: PostgreSQL 17 and Redis 7 containers were in an exited state (stopped 8 days prior), causing backend database disconnection and fallback to an in-process mock memory store.
2. **Infinite 401 & Token Refresh Loop**: The customer frontend app repeatedly queried `/api/v1/wishlist` on page load while unauthenticated. This triggered Axios 401 response interceptors to dispatch `POST /api/v1/auth/refresh-token`, producing an infinite client-side loop of dozens of requests per second.
3. **Developer IP Rate-Limit Lockout**: Express's `authLimiter` was mounted globally on `/api/v1/auth` with a strict production quota of 5 requests per 15 minutes. The frontend's rapid refresh attempts exhausted this quota in seconds, locking out localhost (`::1`) developers with `429 Too Many Requests`.
4. **Registration Validation Key Mismatch**: The frontend registration form submitted `name` instead of `fullName`, causing `400 Bad Request ("Full name is required")` even when valid names were supplied.
5. **Route Aliasing & Controller Discrepancies**: Discrepancies existed between Postman collection definitions and backend route specifications (e.g., `/categories/tree` vs `/categories`, `/reviews/product/:id` vs `/reviews/products/:id`, `/inventory/status` vs `/inventory`, `/chat/faq` vs `/chat/bot-query`).
6. **Noisy Console Stack Traces**: Routine HTTP 4xx operational responses (such as 401s and 400s) logged full 15-line internal router stack traces to the console, making routine client errors appear as server crashes.
7. **Product Filtering & Multi-Faceted Search Overhaul**: Frontend catalog filters (category slugs, price slider, size selection, color palette, customer rating sort) and text search were non-functional or returning 0 results due to parameter key discrepancies (`category` vs `category_id`), unhandled category slug resolution, unhandled parent-child category hierarchies in PostgreSQL, symbol lookup omissions in Sequelize `variantWhere`, and missing rating sort handling.

All root causes were diagnosed, patched, linted, and verified.

---

## 2. Root Cause Analysis & Solutions

### 2.1. Docker Infrastructure & Database Connection
* **Problem:** `GET /api/v1/health` reported `"database": "disconnected"`.
* **Root Cause:** Docker containers `stackstorm_postgres` (`postgres:17-alpine`) and `stackstorm_redis` (`redis:7-alpine`) were in `Exited (0)` state.
* **Solution:** Executed `docker compose up -d`. Both containers resumed in healthy status, and persistent volumes (`stackstorm_postgres_data`, `stackstorm_redis_data`) restored database connection and all seed catalogs.

### 2.2. Frontend Wishlist & 401 Refresh Interceptor Loop
* **Problem:** Hundreds of `[401] GET /api/v1/wishlist` and `[400] POST /api/v1/auth/refresh-token` warnings spammed the backend terminal continuously.
* **Root Cause:**
  1. `WishlistProvider` in the frontend mounted on page load and invoked `wishlistApi.getWishlist()`.
  2. The backend route required strict authentication and returned `401 Unauthorized`.
  3. Axios's response interceptor intercepted the 401 and dispatched `POST /auth/refresh-token`.
  4. Without an active refresh token cookie/body, this failed with 400.
  5. The React component re-rendered and re-triggered `getWishlist()`, creating an infinite loop.
* **Solution:**
  1. **Frontend:** In `stackstorm-frontend-customer/src/api/wishlist.api.js`, added a check: if `!getAccessToken()`, immediately return local storage fallback without initiating an HTTP network request.
  2. **Backend:** In [src/routes/wishlist.routes.js](file:///c:/Users/ASUS%20TUF/Desktop/Design%20project/stackstorm-backend/src/routes/wishlist.routes.js) and [src/controllers/wishlist.controller.js](file:///c:/Users/ASUS%20TUF/Desktop/Design%20project/stackstorm-backend/src/controllers/wishlist.controller.js), added `optionalAuthenticate` middleware to `GET /api/v1/wishlist`. If unauthenticated, it returns `200 OK` with an empty array `[]` (`Guest wishlist empty`), eliminating 401 responses entirely for unauthenticated shoppers.

### 2.3. Rate Limiter Scope & Localhost Development Exemption
* **Problem:** Developers received `{ "success": false, "message": "Too many authentication attempts. Please try again after 15 minutes." }`.
* **Root Cause:**
  1. `authLimiter` was wrapping all `/api/v1/auth` endpoints indiscriminately in `src/app.js`.
  2. Quota was set to 5 requests per 15 minutes without distinguishing development vs production.
* **Solution:**
  1. In [src/middleware/rateLimiter.js](file:///c:/Users/ASUS%20TUF/Desktop/Design%20project/stackstorm-backend/src/middleware/rateLimiter.js), exempted loopback addresses (`::1`, `127.0.0.1`, `localhost`) from rate limiting when `NODE_ENV === 'development'`.
  2. Increased development ceiling to 100 requests per 15 minutes.
  3. In [src/routes/auth.routes.js](file:///c:/Users/ASUS%20TUF/Desktop/Design%20project/stackstorm-backend/src/routes/auth.routes.js), scoped `authLimiter` strictly to brute-force vectors (`POST /login` and `POST /register`), while allowing `/me`, `/refresh-token`, and `/logout` to run without consuming login quotas.

### 2.4. Customer Registration Field Normalization
* **Problem:** Submitting registration via the frontend resulted in `400 Bad Request: Full name is required` even when a valid name was entered.
* **Root Cause:** The frontend `RegisterForm.jsx` sent `{ name: "..." }` while the backend Express validator evaluated `body('fullName')`.
* **Solution:**
  1. In [src/routes/auth.routes.js](file:///c:/Users/ASUS%20TUF/Desktop/Design%20project/stackstorm-backend/src/routes/auth.routes.js), injected normalization middleware before validation: `if (!req.body.fullName && req.body.name) req.body.fullName = req.body.name;`.
  2. In [src/controllers/auth.controller.js](file:///c:/Users/ASUS%20TUF/Desktop/Design%20project/stackstorm-backend/src/controllers/auth.controller.js), bound `fullName = req.body.fullName || req.body.name`.
  3. In `stackstorm-frontend-customer/src/components/auth/RegisterForm.jsx`, updated the form payload to send both `fullName` and `name`.

### 2.5. Express Global Error Handler Logging Clean-up
* **Problem:** Normal 400 and 401 responses dumped massive 15-line internal stack traces into the terminal.
* **Root Cause:** [src/middleware/errorHandler.js](file:///c:/Users/ASUS%20TUF/Desktop/Design%20project/stackstorm-backend/src/middleware/errorHandler.js) called `logger.error` with `err.stack` for all HTTP error codes.
* **Solution:** Differentiated operational client errors from genuine server errors. For status codes `< 500`, the handler now logs concise, readable warnings (`logger.warn([401] GET /api/v1/wishlist - Authentication token is required)`), while reserving full stack traces exclusively for `500+` server faults.

### 2.6. Postman Collection & Backend Route Aliasing
* **Problem:** Out-of-the-box Postman collection requests failed due to parameter mismatches and token overwriting.
* **Solutions Applied:**
  * **Sample Product ID:** Updated `sampleProductId` variable from user UUID `b0000000-...` to seeded product UUID `c0000000-0000-0000-0000-000000000001`.
  * **Token Isolation:** Added `adminAccessToken` and `customerAccessToken` variables. Updated test scripts in Admin Login and Customer Login to store separate tokens, preventing customer tokens from overwriting admin privileges on subsequent requests.
  * **Categories Route:** Added `router.get('/tree', categoryController.getCategories)` alias in [src/routes/category.routes.js](file:///c:/Users/ASUS%20TUF/Desktop/Design%20project/stackstorm-backend/src/routes/category.routes.js).
  * **Reviews Route:** Added `router.get('/product/:id', reviewController.getProductReviews)` singular alias in [src/routes/review.routes.js](file:///c:/Users/ASUS%20TUF/Desktop/Design%20project/stackstorm-backend/src/routes/review.routes.js).
  * **Loyalty Route:** Added root `router.get('/', ...)` alias in [src/routes/loyalty.routes.js](file:///c:/Users/ASUS%20TUF/Desktop/Design%20project/stackstorm-backend/src/routes/loyalty.routes.js).
  * **Chatbot Route:** Added `router.post('/faq', ChatController.queryBot)` alias in [src/routes/chat.routes.js](file:///c:/Users/ASUS%20TUF/Desktop/Design%20project/stackstorm-backend/src/routes/chat.routes.js), and updated controller to accept either `message` or `question`.
  * **Inventory Adjustment:** In [src/controllers/inventory.controller.js](file:///c:/Users/ASUS%20TUF/Desktop/Design%20project/stackstorm-backend/src/controllers/inventory.controller.js), supported both `delta` and `adjustment` keys. Added `router.get('/', ...)` alias for warehouse status in [src/routes/inventory.routes.js](file:///c:/Users/ASUS%20TUF/Desktop/Design%20project/stackstorm-backend/src/routes/inventory.routes.js).

### 2.7. Product Filtering, Hierarchical Categories & Multi-Faceted Search
* **Problem:** In the customer storefront, clicking category navigation/pills (e.g., Men, Women, Batik Shirts), adjusting the price slider, clicking color swatches (e.g., Pure White, Kandyan Red, Ceylon Emerald), sorting by Customer Rating, or performing keyword search either failed to filter products or returned 0 results.
* **Root Causes:**
  1. **Parameter Name Mismatch**: The frontend sent `category`, `minPrice`/`max_price`, and `search`/`q`. [src/controllers/product.controller.js](file:///c:/Users/ASUS%20TUF/Desktop/Design%20project/stackstorm-backend/src/controllers/product.controller.js) strictly expected `category_id: categoryId = req.query.category_id`, ignoring the frontend's category parameter completely.
  2. **Hierarchical Categories & Slug vs UUID**: The frontend sent category slugs (e.g. `'men'`, `'women'`, `'batik-shirts'`) or `'all'`. In PostgreSQL, `category_id` is a UUID column, so passing a slug directly threw `invalid input syntax for type uuid` errors. Furthermore, products are assigned to **subcategories** (`Batik Shirts`, `Formal Trousers`, etc.) while navbar links pass parent slugs (`men`, `women`). Querying `WHERE category_id = Men_UUID` returned 0 products because parent categories do not have products directly attached without recursive child traversal.
  3. **Sequelize Symbol Detection for Variant Filters**: In [src/services/product.service.js](file:///c:/Users/ASUS%20TUF/Desktop/Design%20project/stackstorm-backend/src/services/product.service.js), variant filters checked `Object.keys(variantWhere).length > 0`. Because Sequelize operators like `Op.or` and `Op.and` are JavaScript **Symbols**, `Object.keys()` returned `0`, causing Sequelize to receive `where: undefined` and bypass variant filtering (such as color) entirely.
  4. **Color Swatch Term Mismatch**: Frontend swatches use curated compound names (`Pure White`, `Kandyan Red`, `Ceylon Emerald`), whereas database variants store specific shades (`Optical White`, `Ivory White`, `Crimson Red`, `Emerald Green`).
  5. **Narrow Search Scope**: Search previously only queried product `title` and `description` using `iLike`. Searching for category names (e.g. `"women"`, `"kids"`, `"saris"`, `"batik"`) or variant attributes returned 0 matches.
  6. **Customer Rating Sort Unhandled**: The frontend sort option `rating` fell through unhandled in backend SQL ordering.
* **Solutions Applied:**
  1. **Flexible Controller Aliasing**: Updated [src/controllers/product.controller.js](file:///c:/Users/ASUS%20TUF/Desktop/Design%20project/stackstorm-backend/src/controllers/product.controller.js) to accept aliases: `category` / `category_id` / `categoryId`, `min_price` / `minPrice`, `max_price` / `maxPrice`, `search` / `q` / `keyword`, and defaulted pagination `limit: 12`.
  2. **Hierarchical Category Resolution**: In [src/services/product.service.js](file:///c:/Users/ASUS%20TUF/Desktop/Design%20project/stackstorm-backend/src/services/product.service.js), added automatic slug and UUID resolution. If a category has child subcategories (such as `'men'` having Batik Shirts, Formal Trousers, Tees & Polos, Linen Shirts), it queries `category_id: { [Op.in]: [targetCat.id, ...childIds] }`. Bypassed category filtering when `category: 'all'` is passed. Mirrored identical resolution in `filterFallbackCatalog`.
  3. **Multi-Field Intelligent Search**: Broadened search queries to match product `title`, `description`, associated `Category.name`/`slug`, and variant `sku`/`color`.
  4. **Color Swatch Mapping & Symbol Support**: Mapped compound swatch terms to underlying color families, and replaced `Object.keys(variantWhere)` with `Reflect.ownKeys(variantWhere)` so Sequelize Symbols (`Op.or`, `Op.and`) are recognized.
  5. **Rating Sort & Review Aggregates**: Added support for `sort=rating` using a SQL subquery for average ratings, and included hydrated `reviews`, `review_count`, and `rating` on all returned product objects.

---

## 3. Summary of Files Modified

| Repository | File Path | Nature of Change |
| :--- | :--- | :--- |
| `backend` | [src/app.js](file:///c:/Users/ASUS%20TUF/Desktop/Design%20project/stackstorm-backend/src/app.js) | Removed blanket `authLimiter` from `/api/v1/auth` root mount |
| `backend` | [src/routes/auth.routes.js](file:///c:/Users/ASUS%20TUF/Desktop/Design%20project/stackstorm-backend/src/routes/auth.routes.js) | Scoped `authLimiter` to `/login` and `/register`; added `name` &rarr; `fullName` mapping |
| `backend` | [src/controllers/auth.controller.js](file:///c:/Users/ASUS%20TUF/Desktop/Design%20project/stackstorm-backend/src/controllers/auth.controller.js) | Handled `fullName || name` fallback in registration handler |
| `backend` | [src/middleware/rateLimiter.js](file:///c:/Users/ASUS%20TUF/Desktop/Design%20project/stackstorm-backend/src/middleware/rateLimiter.js) | Exempted localhost loopback in development; raised dev limit to 100 |
| `backend` | [src/middleware/errorHandler.js](file:///c:/Users/ASUS%20TUF/Desktop/Design%20project/stackstorm-backend/src/middleware/errorHandler.js) | Formatted 4xx client errors as single-line warnings; silenced noisy stack traces |
| `backend` | [src/routes/wishlist.routes.js](file:///c:/Users/ASUS%20TUF/Desktop/Design%20project/stackstorm-backend/src/routes/wishlist.routes.js) | Added `optionalAuthenticate` to `GET /` to support unauthenticated guest queries |
| `backend` | [src/controllers/wishlist.controller.js](file:///c:/Users/ASUS%20TUF/Desktop/Design%20project/stackstorm-backend/src/controllers/wishlist.controller.js) | Returned `200 OK` empty array `[]` for guests instead of throwing `401 Unauthorized` |
| `backend` | [src/routes/category.routes.js](file:///c:/Users/ASUS%20TUF/Desktop/Design%20project/stackstorm-backend/src/routes/category.routes.js) | Added `/tree` alias route for category hierarchy tree |
| `backend` | [src/routes/review.routes.js](file:///c:/Users/ASUS%20TUF/Desktop/Design%20project/stackstorm-backend/src/routes/review.routes.js) | Added singular `/product/:id` alias route for product reviews |
| `backend` | [src/routes/loyalty.routes.js](file:///c:/Users/ASUS%20TUF/Desktop/Design%20project/stackstorm-backend/src/routes/loyalty.routes.js) | Added root `GET /` alias route; cleaned up module imports and lint errors |
| `backend` | [src/routes/chat.routes.js](file:///c:/Users/ASUS%20TUF/Desktop/Design%20project/stackstorm-backend/src/routes/chat.routes.js) | Added `/faq` alias route for automated chatbot probe |
| `backend` | [src/controllers/chat.controller.js](file:///c:/Users/ASUS%20TUF/Desktop/Design%20project/stackstorm-backend/src/controllers/chat.controller.js) | Accepted `message || question` body property in `queryBot` |
| `backend` | [src/routes/inventory.routes.js](file:///c:/Users/ASUS%20TUF/Desktop/Design%20project/stackstorm-backend/src/routes/inventory.routes.js) | Added root `GET /` alias route for inventory warehouse status |
| `backend` | [src/controllers/inventory.controller.js](file:///c:/Users/ASUS%20TUF/Desktop/Design%20project/stackstorm-backend/src/controllers/inventory.controller.js) | Accepted both `delta` and `adjustment` fields in `adjustStockLegacy` |
| `backend` | [src/controllers/product.controller.js](file:///c:/Users/ASUS%20TUF/Desktop/Design%20project/stackstorm-backend/src/controllers/product.controller.js) | Supported parameter aliases (`category`, `search`, `minPrice`/`maxPrice`), default limit 12 |
| `backend` | [src/services/product.service.js](file:///c:/Users/ASUS%20TUF/Desktop/Design%20project/stackstorm-backend/src/services/product.service.js) | Hierarchical category resolution, multi-field search, color mapping, `Reflect.ownKeys`, rating sort |
| `backend` | [StackStorm_Postman_Collection.json](file:///c:/Users/ASUS%20TUF/Desktop/Design%20project/stackstorm-backend/StackStorm_Postman_Collection.json) | Updated valid catalog UUIDs, isolated admin/customer token variables, aligned route URLs |
| `frontend` | `src/api/wishlist.api.js` | Added token presence guard to prevent unauthenticated guest network requests |
| `frontend` | `src/components/auth/RegisterForm.jsx` | Updated submit payload to include `fullName` alongside `name` |

---

## 4. Verification & Test Audit

### 4.1. Postman End-to-End Suite:
* **Total Endpoints Tested**: 38 requests across 13 modules
* **Successful Operational Responses**: 35 / 38 (200 OK / 201 Created)
* **Expected Business-Rule Guards**: 3 / 3
  1. `GET /orders/{{sampleOrderId}}/track` &rarr; `404 Not Found` (Requires an active placed order UUID)
  2. `POST /reviews` &rarr; `403 Forbidden` (`Only verified buyers with delivered orders can review this product` - anti-fraud guard)
  3. `POST /returns` &rarr; `404 Not Found` (Requires an existing delivered order item UUID)

### 4.2. Product Catalog Search & Faceted Filtering Verification:
* **Integration Tests**: `tests/integration/productListing.test.js` &rarr; 7 / 7 passed
* **Unit Tests**: `tests/unit/services/productFilter.test.js` &rarr; 10 / 10 passed
* **Live HTTP & Vite Proxy Verifications**:
  * **Category hierarchy**: `category=men` (12 items across 4 subcategories), `category=women` (9 items across 4 subcategories), `category=kids` (2 items), `category=accessories` (2 items), `category=men-batik-shirts` (4 items)
  * **Multi-field search**: `search=batik` (12 items), `search=sari` (9 items), `search=women` (9 items), `search=pants` (3 items)
  * **Color swatches**: `color=Ocean Blue` (3 items), `color=Kandyan Red` (4 items), `color=Pure White` (2 items), `color=Ceylon Emerald` (4 items)
  * **Price budget & sorting**: `max_price=5000` (10 items), `sort=price_asc` (lowest LKR 2,950 first), `sort=price_desc` (highest LKR 18,900 first), `sort=rating` (highest customer rating first)

---

## 5. Deployment & Local Development Notes

* **Starting Backend Services**: Ensure Docker Desktop is running, then run `docker compose up -d` followed by `npm start`.
* **Testing Postman Suite**: Import the updated [StackStorm_Postman_Collection.json](file:///c:/Users/ASUS%20TUF/Desktop/Design%20project/stackstorm-backend/StackStorm_Postman_Collection.json). Run `02. Authentication & Security` requests first to populate `adminAccessToken` and `customerAccessToken`.
