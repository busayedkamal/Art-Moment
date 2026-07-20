import {
  DEFAULT_REWARD_RULES,
  getWalletRewardPoints,
  pointsToRewardValue,
} from './rewardPoints';

export function normalizeWalletPhone(rawPhone) {
  let phone = String(rawPhone || '').replace(/\D/g, '');
  if (phone.startsWith('00966')) phone = phone.slice(5);
  if (phone.startsWith('966')) phone = phone.slice(3);
  if (phone.startsWith('0')) phone = phone.slice(1);
  return phone;
}

function walletBalance(wallet, rules = DEFAULT_REWARD_RULES) {
  return getWalletRewardPoints(wallet, rules);
}

function walletId(wallet) {
  const id = Number(wallet?.id);
  return Number.isFinite(id) ? id : 0;
}

export function choosePreferredWallet(wallets = [], rules = DEFAULT_REWARD_RULES) {
  return wallets.reduce((preferred, wallet) => {
    if (!preferred) return wallet;

    const balanceDifference = walletBalance(wallet, rules) - walletBalance(preferred, rules);
    if (balanceDifference > 0) return wallet;
    if (balanceDifference < 0) return preferred;

    return walletId(wallet) >= walletId(preferred) ? wallet : preferred;
  }, null);
}

export function getPreferredWallets(wallets = [], rules = DEFAULT_REWARD_RULES) {
  const walletsByPhone = new Map();

  wallets.forEach((wallet) => {
    const phone = normalizeWalletPhone(wallet?.phone);
    if (!phone) return;

    const current = walletsByPhone.get(phone);
    walletsByPhone.set(phone, choosePreferredWallet([current, wallet].filter(Boolean), rules));
  });

  return [...walletsByPhone.values()];
}

export function getTotalRewardPoints(wallets = [], rules = DEFAULT_REWARD_RULES) {
  return getPreferredWallets(wallets, rules)
    .reduce((total, wallet) => total + walletBalance(wallet, rules), 0);
}

export function getTotalRewardValue(wallets = [], rules = DEFAULT_REWARD_RULES) {
  return pointsToRewardValue(getTotalRewardPoints(wallets, rules), rules);
}

// Backward-compatible monetary total for the existing dashboard/report callers.
export function getTotalAvailablePoints(wallets = [], rules = DEFAULT_REWARD_RULES) {
  return getTotalRewardValue(wallets, rules);
}
