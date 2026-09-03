// ./src/store/useProStore.ts
import { create } from 'zustand';
import { CustomerInfo } from 'react-native-purchases';

interface ProState {
  customerInfo: CustomerInfo | null;
  isPro: boolean;
  updateCustomerInfo: (info: CustomerInfo) => void;
}

export const useProStore = create<ProState>((set) => ({
  customerInfo: null,
  isPro: false,

  updateCustomerInfo: (info: CustomerInfo) => {
    // Check if the user has the active 'MyTurn Pro' entitlement
    const isProActive = typeof info.entitlements.active['MyTurn Pro'] !== 'undefined';
    
    set({
      customerInfo: info,
      isPro: isProActive,
    });
  },
}));