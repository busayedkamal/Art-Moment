# Mixed Order Status Acceptance

Run these checks on Staging after applying `202608250002_mixed_order_item_status_hardening.sql`.
Use a mixed order containing one product with quantity 2 and one print item.
Record the product stock before every scenario and restore test data afterward.

## Acceptance matrix

| Scenario | Expected result |
| --- | --- |
| Cancel the product item once | Product stock increases by exactly 2, one status-history row is added, and the print item remains active. |
| Submit `cancelled` for the same item again | The RPC returns `changed: false`; stock and status history do not change. |
| Reactivate the cancelled product | Stock decreases by exactly 2. If stock is insufficient, the RPC fails and both stock and item status remain unchanged. |
| Cancel the final active item | The RPC fails with `cancel_last_active_item_requires_order_cancellation`; use full-order cancellation instead. |
| Cancel the full order after one item was already cancelled | Previously cancelled product stock is not restored a second time. Only active product items are restored. |
| Reopen a fully cancelled order | Only items carrying `status_reason_code = order_cancelled` are reopened and reserved. Items cancelled independently stay cancelled. |
| Set print to `printed` while all product items are ready | The order remains `processing`; `printed` means printing finished but final preparation is pending. |
| Move print from `printed` to `ready` while all products are ready | The order becomes `ready_for_delivery`. |
| Update two different items concurrently | Calls serialize on the order lock; the final aggregate order status matches the final item statuses. |

## Release commands

```powershell
npm run check:mixed-orders
npm run lint
npm run build
```

The release gate is complete only after all rows above pass against Staging data.