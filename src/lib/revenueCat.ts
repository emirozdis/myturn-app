import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import { getRevenueCatApiKey, IS_DEVELOPMENT } from './environment';
import { useProStore } from '../store/useProStore';

let configured = false;
let customerInfoListenerInstalled = false;

function configureRevenueCat() {
  if (configured || (Platform.OS !== 'ios' && Platform.OS !== 'android')) return;

  configured = true;
  void Purchases.setLogLevel(
    IS_DEVELOPMENT ? Purchases.LOG_LEVEL.DEBUG : Purchases.LOG_LEVEL.WARN,
  ).catch((error) => {
    console.warn('[RevenueCat] Could not set log level:', error);
  });
  Purchases.configure({ apiKey: getRevenueCatApiKey() });

  if (!customerInfoListenerInstalled) {
    customerInfoListenerInstalled = true;
    Purchases.addCustomerInfoUpdateListener((info) => {
      useProStore.getState().updateCustomerInfo(info);
    });
  }
}

export async function loginRevenueCat(userId: string) {
  if (!userId || (Platform.OS !== 'ios' && Platform.OS !== 'android')) return;
  configureRevenueCat();
  const { customerInfo } = await Purchases.logIn(userId);
  useProStore.getState().updateCustomerInfo(customerInfo);
}

export async function syncRevenueCat(userId?: string) {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  configureRevenueCat();
  if (userId) await loginRevenueCat(userId);
  const info = await Purchases.getCustomerInfo();
  useProStore.getState().updateCustomerInfo(info);
}
