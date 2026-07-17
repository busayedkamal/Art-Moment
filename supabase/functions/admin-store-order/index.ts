import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';

type ServiceClient = ReturnType<typeof getServiceClient>;

function getBearerToken(req: Request) {
  const header = req.headers.get('authorization') || '';
  return header.match(/^Bearer\s+(.+)$/i)?.[1] || '';
}

async function getAdminActor(req: Request, supabase: ServiceClient) {
  const token = getBearerToken(req);
  if (!token) return null;

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) return null;

  const { data: admins, error: adminError } = await supabase
    .from('admin_users')
    .select('user_id, email');
  if (adminError) throw adminError;

  const userEmail = String(user.email || '').toLowerCase();
  const isAdmin = !admins?.length || admins.some((admin: Record<string, unknown>) => (
    String(admin.user_id || '') === user.id
    || String(admin.email || '').toLowerCase() === userEmail
  ));

  return isAdmin ? { id: user.id, email: userEmail } : null;
}

function getDatabaseErrorCode(message: string) {
  const knownCodes = [
    'not_authorized',
    'invalid_manual_order',
    'invalid_phone',
    'invalid_email',
    'invalid_customer_id',
    'customer_not_found',
    'customer_phone_exists',
    'customer_email_exists',
    'customer_identity_conflict',
    'customer_name_required',
    'invalid_order_items',
    'product_unavailable',
    'product_out_of_stock',
    'discount_reason_required',
    'discount_exceeds_subtotal',
    'amount_paid_exceeds_total',
    'invalid_order_status',
    'invalid_payment_status',
  ];

  return knownCodes.find((code) => message.includes(code)) || 'manual_order_failed';
}

Deno.serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  const supabase = getServiceClient();

  try {
    const actor = await getAdminActor(req, supabase);
    if (!actor) return jsonResponse({ error: 'not_authorized' }, 403);

    const body = await req.json();
    const customer = body?.customer;
    const order = body?.order;
    const items = Array.isArray(body?.items) ? body.items : [];

    if (!customer || !order || items.length === 0 || items.length > 100) {
      return jsonResponse({ error: 'invalid_manual_order' }, 400);
    }

    const { data, error } = await supabase.rpc('admin_create_store_order', {
      p_customer: customer,
      p_items: items,
      p_order: order,
      p_actor_user_id: actor.id,
      p_actor_email: actor.email,
    });

    if (error) {
      console.error('admin-store-order database error:', error);
      const code = getDatabaseErrorCode(String(error.message || ''));
      const status = ['product_unavailable', 'product_out_of_stock', 'customer_identity_conflict', 'customer_phone_exists', 'customer_email_exists']
        .includes(code)
        ? 409
        : code === 'manual_order_failed'
          ? 500
          : 400;
      return jsonResponse({ error: code }, status);
    }

    return jsonResponse(data, 201);
  } catch (error) {
    console.error('admin-store-order error:', error);
    return jsonResponse({ error: 'manual_order_failed' }, 500);
  }
});
