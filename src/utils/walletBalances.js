export function normalizeWalletPhone(rawPhone) {
  let phone = String(rawPhone || '').replace(/\D/g, '');
  if (phone.startsWith('00966')) phone = phone.slice(5);
  if (phone.startsWith('966')) phone = phone.slice(3);
  if (phone.startsWith('0')) phone = phone.slice(1);
  return phone;
}

function walletBalance(wallet) {
  return Number(wallet?.points_balance || 0);
}

function walletId(wallet) {
  const id = Number(wallet?.id);
  return Number.isFinite(id) ? id : 0;
}

export function choosePreferredWallet(wallets = []) {
  return wallets.reduce((preferred, wallet) => {
    if (!preferred) return wallet;

    const balanceDifference = walletBalance(wallet) - walletBalance(preferred);
    if (balanceDifference > 0) return wallet;
    if (balanceDifference < 0) return preferred;

    return walletId(wallet) >= walletId(preferred) ? wallet : preferred;
  }, null);
}

export function getPreferredWallets(wallets = []) {
  const walletsByPhone = new Map();

  wallets.forEach((wallet) => {
    const phone = normalizeWalletPhone(wallet?.phone);
    if (!phone) return;

    const current = walletsByPhone.get(phone);
    walletsByPhone.set(phone, choosePreferredWallet([current, wallet].filter(Boolean)));
  });

  return [...walletsByPhone.values()];
}

export function getTotalAvailablePoints(wallets = []) {
  return getPreferredWallets(wallets)
    .reduce((total, wallet) => total + walletBalance(wallet), 0);
}
