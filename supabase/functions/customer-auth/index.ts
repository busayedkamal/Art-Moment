import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { createPasswordHash, verifyPassword } from '../_shared/password.ts';
import { isValidSaudiMobile, normalizeSaudiPhone, phoneVariants } from '../_shared/phone.ts';
import { getServiceClient } from '../_shared/supabase.ts';

function safeCustomer(customer: Record<string, unknown>) {
  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
  };
}

Deno.serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  try {
    const body = await req.json();
    const mode = body?.mode === 'signup' ? 'signup' : 'login';
    const phone = normalizeSaudiPhone(body?.phone);
    const password = String(body?.password ?? '');
    const email = String(body?.email ?? '').trim() || null;
    const name = String(body?.name ?? '').trim() || null;

    if (!isValidSaudiMobile(phone) || password.length < 6) {
      return jsonResponse({ error: 'invalid_credentials' }, 400);
    }

    const supabase = getServiceClient();
    const variants = phoneVariants(phone);

    if (mode === 'signup') {
      const { data: existingPhone, error: phoneError } = await supabase
        .from('customers')
        .select('id')
        .in('phone', variants)
        .limit(1)
        .maybeSingle();
      if (phoneError) throw phoneError;

      const { data: existingEmail, error: emailError } = email
        ? await supabase.from('customers').select('id').eq('email', email).maybeSingle()
        : { data: null, error: null };
      if (emailError) throw emailError;

      if (existingPhone || existingEmail) {
        return jsonResponse({ error: 'customer_exists' }, 409);
      }

      const passwordHash = await createPasswordHash(password);
      const { data: newCustomer, error: insertError } = await supabase
        .from('customers')
        .insert({
          name,
          email,
          phone,
          password_hash: passwordHash,
        })
        .select('id, name, email, phone')
        .single();

      if (insertError) throw insertError;
      return jsonResponse({ customer: safeCustomer(newCustomer) });
    }

    const { data: customer, error: fetchError } = await supabase
      .from('customers')
      .select('id, name, email, phone, password_hash')
      .in('phone', variants)
      .limit(1)
      .maybeSingle();

    if (fetchError) throw fetchError;

    const passwordCheck = await verifyPassword(password, customer?.password_hash);
    if (!customer || !passwordCheck.valid) {
      return jsonResponse({ error: 'invalid_credentials' }, 401);
    }

    const updates: Record<string, string> = {};
    if (passwordCheck.legacy) updates.password_hash = await createPasswordHash(password);
    if (customer.phone !== phone) updates.phone = phone;

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from('customers')
        .update(updates)
        .eq('id', customer.id);
      if (updateError) throw updateError;
    }

    return jsonResponse({ customer: safeCustomer({ ...customer, ...updates }) });
  } catch (error) {
    console.error('customer-auth error:', error);
    return jsonResponse({ error: 'auth_failed' }, 500);
  }
});
