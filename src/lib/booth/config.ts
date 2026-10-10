// Lancement progressif de Lotexpo Leads : passer à true pour ouvrir la section à tous les exposants.
export const LOTEXPO_LEADS_PUBLIC = false;

// Interrupteur de secours du mode salon hors ligne : false désinstalle le service worker.
export const SALON_OFFLINE_ENABLED = true;

// Paiement en ligne : visible si true, ou pour les admins Lotexpo (tests pendant la bêta).
export const LEADS_PAYMENT_ENABLED = false;

export const isLeadsPaymentVisible = (isLotexpoAdmin: boolean) => LEADS_PAYMENT_ENABLED || isLotexpoAdmin;
