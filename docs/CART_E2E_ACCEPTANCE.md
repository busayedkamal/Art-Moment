# Cart End-to-End Acceptance

This checklist covers the mixed Art Moment cart without using production customer data.

## Test environment

- Run against a staging Supabase project with the same migrations and Edge Functions as production.
- Use synthetic customers, products, coupons, and print files only.
- Disable customer/admin email and WhatsApp notifications in staging.
- Keep the service-role key in the test runner environment only; never expose it to Vite or the browser.
- Reset fixtures after each scenario so stock and order counts are deterministic.

## Acceptance matrix

| Scenario | Expected result | Database assertions |
| --- | --- | --- |
| Print only | Cart shows one print card, print subtotal, zero product subtotal, and checkout succeeds. | One `store_orders` row, print item rows, and draft status becomes `ordered`. |
| Products only | Cart shows product cards, quantities, stock limits, and checkout succeeds. | One order, matching product item rows, and stock decreases once. |
| Print + products | Both sections and subtotals appear; one checkout creates one order. | One order contains both item types; stock and print draft are committed once. |
| Coupon scope `all` | Discount is calculated from the entire eligible subtotal. | Stored subtotal, discount, code, and total match the server calculation. |
| Coupon scope `products` | Only product subtotal is discounted. Print subtotal is unchanged. | Discount never exceeds product subtotal. |
| Coupon scope `print` | Only print subtotal is discounted. Product subtotal is unchanged. | Discount never exceeds print subtotal. |
| Product becomes unavailable | Revalidation blocks checkout and names the availability problem. | No order is created and stock is not changed. |
| Product stock decreases | Quantity is clamped in the cart; checkout rejects stale excess quantity. | No order is created; remaining stock is unchanged by the failed checkout. |
| Print variant is disabled | Checkout displays the print-variant message and keeps the cart intact. | No order is created and the draft remains `ready`. |
| Payment failure and retry | Failure page keeps the order reference and retry returns to the correct order/payment flow. | One order only; payment history records both attempts without changing item rows. |
| Double payment/checkout click | A rapid double click returns the same order and one success state. | One order, one stock deduction, one print draft transition, and one notification set. |
| Existing guest identity | Exact phone + email is accepted; partial or conflicting identity requires login. | No duplicate customer is created. |
| Claim guest order | Registering later with the same phone + email claims the passwordless customer record. | Same customer id gains credentials; previous order becomes visible in `My Orders`. |

## Production-safe smoke result

Tested on `https://www.art-moment.com/store/cart` without creating an order:

- Product-only cart rendered correctly.
- Quantity increment stopped at the available stock of `20`.
- Typing `999` was clamped to `20` and displayed a clear stock-limit message.
- An out-of-stock product displayed `Unavailable` with a disabled add button.
- Checkout presented the three expected steps: customer, delivery, payment/review.

## Regression found and fixed

The checkout compatibility fallback previously treated a duplicate idempotency-key constraint as a missing-column error. It could remove the key and retry the insert, creating a second order. The checkout now:

- Locks submission synchronously in the cart before React rerenders.
- Treats database error `23505` as an idempotent retry.
- Restores any stock reserved by the losing request.
- Removes a duplicate passwordless guest created by a concurrent request.
- Returns the existing order and tracking code instead of inserting again.
- Uses the legacy-column fallback only for actual schema/cache errors.

## Release gate

Do not mark the cart complete until every row in the acceptance matrix passes on staging after deploying the current `store-checkout` function. No additional cart feature work is required after this gate passes.
