import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from('settings')
      .select('a4_price, photo_4x6_price, delivery_fee_default, is_dynamic_pricing_enabled, tier_1_limit, tier_1_price, tier_2_limit, tier_2_price, tier_3_price')
      .eq('id', 1)
      .single();

    if (error) throw error;
    return jsonResponse({ settings: data });
  } catch (error) {
    console.error('public-settings error:', error);
    return jsonResponse({ error: 'Unable to load public settings.' }, 500);
  }
});
