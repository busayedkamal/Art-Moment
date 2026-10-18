-- Customer-facing receipt references must use the same short order number
-- accepted by order tracking. Never expose UUID fragments or tracking tokens.

begin;

-- Some deployed databases still carry the original immutability trigger in
-- addition to the hardened trigger. Suspend both only for this controlled fix.
drop trigger if exists receipts_guard_immutability on public.receipts;
drop trigger if exists receipts_protect_record on public.receipts;

update public.receipts as receipt
set order_reference = print_order.short_id::text
from public.orders as print_order
where receipt.order_type = 'print'
  and receipt.print_order_id = print_order.id
  and nullif(trim(print_order.short_id::text), '') is not null
  and receipt.order_reference is distinct from print_order.short_id::text;

update public.receipts as receipt
set order_reference = store_order.short_id::text
from public.store_orders as store_order
where receipt.order_type = 'store'
  and receipt.store_order_id = store_order.id
  and nullif(trim(store_order.short_id::text), '') is not null
  and receipt.order_reference is distinct from store_order.short_id::text;

do $restore_receipt_guards$
begin
  if to_regprocedure('public.guard_receipt_immutability()') is not null then
    execute 'create trigger receipts_guard_immutability before update or delete on public.receipts for each row execute function public.guard_receipt_immutability()';
  end if;

  if to_regprocedure('public.protect_receipt_record()') is not null then
    execute 'create trigger receipts_protect_record before update or delete on public.receipts for each row execute function public.protect_receipt_record()';
  end if;
end;
$restore_receipt_guards$;

commit;