export const DEFAULT_REWARD_RULES = Object.freeze({
  enabled: true,
  pointsPerRiyal: 2,
  pointValue: 0.01,
  minimumRedemptionPoints: 500,
  maximumRedemptionPercent: 25,
  expiryMonths: 4,
  signupBonusPoints: 200,
  signupBonusEnabled: true,
});

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function normalizeRewardRules(row = {}) {
  return {
    enabled: (row.rewardProgramEnabled ?? row.reward_program_enabled)
      ?? DEFAULT_REWARD_RULES.enabled,
    pointsPerRiyal: clampNumber(
      row.rewardPointsPerRiyal ?? row.reward_points_per_riyal,
      DEFAULT_REWARD_RULES.pointsPerRiyal,
      0,
      100,
    ),
    pointValue: clampNumber(
      row.rewardPointValue ?? row.reward_point_value,
      DEFAULT_REWARD_RULES.pointValue,
      0.0001,
      100,
    ),
    minimumRedemptionPoints: Math.round(clampNumber(
      row.rewardMinimumRedemptionPoints ?? row.reward_minimum_redemption_points,
      DEFAULT_REWARD_RULES.minimumRedemptionPoints,
      0,
      10000000,
    )),
    maximumRedemptionPercent: clampNumber(
      row.rewardMaximumRedemptionPercent ?? row.reward_maximum_redemption_percent,
      DEFAULT_REWARD_RULES.maximumRedemptionPercent,
      0,
      100,
    ),
    expiryMonths: Math.round(clampNumber(
      row.rewardExpiryMonths ?? row.reward_expiry_months,
      DEFAULT_REWARD_RULES.expiryMonths,
      1,
      60,
    )),
    signupBonusPoints: Math.round(clampNumber(
      row.rewardSignupBonusPoints ?? row.reward_signup_bonus_points,
      DEFAULT_REWARD_RULES.signupBonusPoints,
      0,
      1000000,
    )),
    signupBonusEnabled: (row.rewardSignupBonusEnabled ?? row.reward_signup_bonus_enabled)
      ?? DEFAULT_REWARD_RULES.signupBonusEnabled,
  };
}

export function getRewardRulesPayload(rules) {
  const normalized = normalizeRewardRules(rules);
  return {
    reward_program_enabled: Boolean(normalized.enabled),
    reward_points_per_riyal: normalized.pointsPerRiyal,
    reward_point_value: normalized.pointValue,
    reward_minimum_redemption_points: normalized.minimumRedemptionPoints,
    reward_maximum_redemption_percent: normalized.maximumRedemptionPercent,
    reward_expiry_months: normalized.expiryMonths,
    reward_signup_bonus_points: normalized.signupBonusPoints,
    reward_signup_bonus_enabled: Boolean(normalized.signupBonusEnabled),
  };
}

export function pointsToRewardValue(points, rules = DEFAULT_REWARD_RULES) {
  const normalized = normalizeRewardRules(rules);
  return Math.round((Number(points || 0) * normalized.pointValue + Number.EPSILON) * 100) / 100;
}

export function rewardValueToPoints(value, rules = DEFAULT_REWARD_RULES) {
  const normalized = normalizeRewardRules(rules);
  if (normalized.pointValue <= 0) return 0;
  return Math.max(0, Math.floor((Number(value || 0) + Number.EPSILON) / normalized.pointValue));
}

export function calculateEarnedRewardPoints(eligibleAmount, rules = DEFAULT_REWARD_RULES) {
  const normalized = normalizeRewardRules(rules);
  if (!normalized.enabled) return 0;
  return Math.max(0, Math.floor(Number(eligibleAmount || 0) * normalized.pointsPerRiyal));
}

export function getWalletRewardPoints(wallet, rules = DEFAULT_REWARD_RULES) {
  const explicitPoints = Number(wallet?.reward_points_balance);
  if (Number.isFinite(explicitPoints)) return Math.round(explicitPoints);
  return rewardValueToPoints(wallet?.points_balance, rules);
}

export function getRewardRedemptionLimit(orderValue, availablePoints, rules = DEFAULT_REWARD_RULES) {
  const normalized = normalizeRewardRules(rules);
  const percentValue = Math.max(0, Number(orderValue || 0))
    * (normalized.maximumRedemptionPercent / 100);
  const percentPoints = rewardValueToPoints(percentValue, normalized);
  const maximumPoints = Math.max(0, Math.min(Math.floor(Number(availablePoints || 0)), percentPoints));
  return {
    maximumPoints,
    maximumValue: pointsToRewardValue(maximumPoints, normalized),
    canRedeem: normalized.enabled
      && Number(availablePoints || 0) >= normalized.minimumRedemptionPoints
      && maximumPoints >= normalized.minimumRedemptionPoints,
  };
}

