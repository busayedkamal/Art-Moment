import { normalizeSaudiPhone, phoneVariants } from './phone.ts';

type ServiceClient = {
  from: (table: string) => any;
  rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: any }>;
};

function daysUntil(value: unknown) {
  const timestamp = new Date(String(value || '')).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.ceil((timestamp - Date.now()) / 86400000));
}

export async function fetchRewardPointsSummary(
  supabase: ServiceClient,
  phone: unknown,
  options: { includeActivities?: boolean } = {},
) {
  const normalizedPhone = normalizeSaudiPhone(phone);
  if (!normalizedPhone) return null;

  const { data: settings, error: settingsError } = await supabase
    .from('settings')
    .select('reward_program_enabled, reward_points_per_riyal, reward_point_value, reward_minimum_redemption_points, reward_maximum_redemption_percent, reward_expiry_months, reward_signup_bonus_enabled, reward_signup_bonus_points')
    .eq('id', 1)
    .maybeSingle();
  if (settingsError) throw settingsError;

  const pointValue = Number(settings?.reward_point_value || 0.01);
  const { data: wallets, error: walletError } = await supabase
    .from('wallets')
    .select('id, reward_points_balance, points_balance, store_credit_balance')
    .in('phone', phoneVariants(normalizedPhone));
  if (walletError) throw walletError;

  const wallet = (wallets || []).sort((left: Record<string, unknown>, right: Record<string, unknown>) => {
    const leftPoints = Number(left.reward_points_balance ?? Math.round(Number(left.points_balance || 0) / pointValue));
    const rightPoints = Number(right.reward_points_balance ?? Math.round(Number(right.points_balance || 0) / pointValue));
    return rightPoints - leftPoints || Number(right.id || 0) - Number(left.id || 0);
  })[0];

  const rules = {
    enabled: settings?.reward_program_enabled !== false,
    pointsPerRiyal: Number(settings?.reward_points_per_riyal || 2),
    pointValue,
    minimumRedemptionPoints: Number(settings?.reward_minimum_redemption_points || 500),
    maximumRedemptionPercent: Number(settings?.reward_maximum_redemption_percent || 25),
    expiryMonths: Number(settings?.reward_expiry_months || 4),
    signupBonusEnabled: settings?.reward_signup_bonus_enabled !== false,
    signupBonusPoints: Number(settings?.reward_signup_bonus_points || 200),
  };

  if (!wallet) {
    return {
      ...rules,
      points: 0,
      valueSar: 0,
      storeCreditSar: 0,
      earnedPointsTotal: 0,
      redeemedPointsTotal: 0,
      restoredPointsTotal: 0,
      expiredPointsTotal: 0,
      expiring7DaysPoints: 0,
      expiring30DaysPoints: 0,
      expiringSoonPoints: 0,
      nextExpiryAt: null,
      nextExpiryInDays: null,
      pointsNeededForRedemption: rules.minimumRedemptionPoints,
      canRedeem: false,
      expiringLots: [],
      activities: [],
    };
  }

  await supabase.rpc('expire_reward_points', { p_wallet_id: wallet.id });

  const fetchTransactions = async () => {
    const pageSize = 1000;
    const allRows: Array<Record<string, unknown>> = [];
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from('wallet_transactions')
        .select('id, type, amount_value, reward_points_delta, reward_points_remaining, reward_point_value, reward_eligible_amount, reward_expires_at, reward_source_type, reward_source_id, reward_metadata, created_at')
        .eq('wallet_id', wallet.id)
        .order('created_at', { ascending: false })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      allRows.push(...(data || []));
      if (!data || data.length < pageSize) break;
    }
    return allRows;
  };

  const [{ data: refreshedWallet, error: refreshedWalletError }, transactions] = await Promise.all([
    supabase
      .from('wallets')
      .select('reward_points_balance, points_balance, store_credit_balance')
      .eq('id', wallet.id)
      .single(),
    fetchTransactions(),
  ]);
  if (refreshedWalletError) throw refreshedWalletError;

  const rows = transactions || [];
  const now = Date.now();
  const expiringLots = rows
    .filter((row) => Number(row.reward_points_remaining || 0) > 0
      && new Date(String(row.reward_expires_at || '')).getTime() > now)
    .map((row) => ({
      id: row.id,
      points: Number(row.reward_points_remaining || 0),
      valueSar: Number((Number(row.reward_points_remaining || 0) * Number(row.reward_point_value || pointValue)).toFixed(2)),
      expiresAt: row.reward_expires_at,
      daysRemaining: daysUntil(row.reward_expires_at),
      sourceType: row.reward_source_type || null,
      sourceId: row.reward_source_id || null,
      earnedAt: row.created_at,
    }))
    .sort((left, right) => new Date(String(left.expiresAt)).getTime() - new Date(String(right.expiresAt)).getTime());

  const sumByTypes = (types: string[], positive = false) => rows.reduce((sum, row) => {
    if (!types.includes(String(row.type || ''))) return sum;
    const delta = Number(row.reward_points_delta || 0);
    return sum + (positive ? Math.max(0, delta) : Math.abs(Math.min(0, delta)));
  }, 0);
  const points = Number(refreshedWallet.reward_points_balance
    ?? Math.round(Number(refreshedWallet.points_balance || 0) / pointValue));
  const expiring7DaysPoints = expiringLots
    .filter((lot) => Number(lot.daysRemaining) <= 7)
    .reduce((sum, lot) => sum + lot.points, 0);
  const expiring30DaysPoints = expiringLots
    .filter((lot) => Number(lot.daysRemaining) <= 30)
    .reduce((sum, lot) => sum + lot.points, 0);

  const activities = options.includeActivities === false
    ? []
    : rows
      .filter((row) => Number(row.reward_points_delta || 0) !== 0)
      .slice(0, 12)
      .map((row) => ({
        id: row.id,
        type: row.type,
        pointsDelta: Number(row.reward_points_delta || 0),
        valueSar: Number(Math.abs(Number(row.reward_points_delta || 0)) * Number(row.reward_point_value || pointValue)).toFixed(2),
        eligibleAmount: row.reward_eligible_amount == null ? null : Number(row.reward_eligible_amount),
        expiresAt: row.reward_expires_at || null,
        sourceType: row.reward_source_type || null,
        sourceId: row.reward_source_id || null,
        createdAt: row.created_at,
      }));

  return {
    ...rules,
    points,
    valueSar: Number((points * pointValue).toFixed(2)),
    storeCreditSar: Number(refreshedWallet.store_credit_balance || 0),
    earnedPointsTotal: sumByTypes(['reward_points_earn', 'reward_signup_bonus'], true),
    redeemedPointsTotal: sumByTypes(['reward_points_redeem', 'redeem']),
    restoredPointsTotal: sumByTypes(['reward_points_restore'], true),
    expiredPointsTotal: sumByTypes(['reward_points_expire']),
    expiring7DaysPoints,
    expiring30DaysPoints,
    expiringSoonPoints: expiring30DaysPoints,
    nextExpiryAt: expiringLots[0]?.expiresAt || null,
    nextExpiryInDays: expiringLots[0]?.daysRemaining ?? null,
    pointsNeededForRedemption: Math.max(0, rules.minimumRedemptionPoints - points),
    canRedeem: rules.enabled && points >= rules.minimumRedemptionPoints,
    expiringLots,
    activities,
  };
}
