// ./src/components/paywall/PaywallModal.tsx
"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, Circle, CircleDot, Cloud, Infinity as InfinityIcon, Sparkles, X, RefreshCw } from 'lucide-react-native';
import Purchases, { PurchasesPackage } from 'react-native-purchases';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { Text } from '../ui/Text';
import { ActionProgress } from '../ui/ActionProgress';
import { ACCENT } from '../../lib/theme';
import { useProStore } from '../../store/useProStore';
import { apiClient } from '../../lib/apiClient';
import { lightTap, notifySuccess, selectionTick } from '../../lib/haptics';

const PRO_MONTHLY_PRICE = '$3.99';
const PRO_ANNUAL_PRICE = '$39.99';
const PRO_ANNUAL_MONTHLY_PRICE = '$3.33';
const FREE_BOOST_PRICE = '$3.99';
const PRO_BOOST_PRICE = '$2.99';

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PaywallModal({ isOpen, onClose }: PaywallModalProps) {
  const insets = useSafeAreaInsets();
  const isPro = useProStore((state) => state.isPro);
  const [packages, setPackages] = useState<{ annual: PurchasesPackage | null; monthly: PurchasesPackage | null; boost: PurchasesPackage | null }>({ annual: null, monthly: null, boost: null });
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
  const [loadingOfferings, setLoadingOfferings] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const fetchOfferings = useCallback(async () => {
    setLoadingOfferings(true);
    try {
      const offerings = await Purchases.getOfferings();
      const annual = offerings.current?.annual || null;
      const monthly = offerings.current?.monthly || null;
      const boost = offerings.current?.availablePackages.find((candidate) => {
        const id = `${candidate.identifier} ${candidate.product.identifier}`.toLowerCase();
        const isBoost = id.includes('boost');
        const isProBoost = id.includes('pro');
        return isBoost && (isPro ? isProBoost : !isProBoost);
      }) || null;

      setPackages({ annual, monthly, boost });
      setSelectedPackage(annual || monthly || boost);
    } catch (error) {
      console.warn('Error fetching RevenueCat offerings:', error);
    } finally {
      setLoadingOfferings(false);
    }
  }, [isPro]);

  useEffect(() => {
    if (isOpen) {
      void fetchOfferings();
    }
  }, [isOpen, fetchOfferings]);

  const handlePurchase = async () => {
    if (!selectedPackage || purchasing) return;
    lightTap();
    setPurchasing(true);
    try {
      const isBoostPurchase = packages.boost?.identifier === selectedPackage.identifier;
      const { customerInfo } = await Purchases.purchasePackage(selectedPackage);
      useProStore.getState().updateCustomerInfo(customerInfo);
      if (isBoostPurchase) {
        const result = await apiClient.request('boost/purchase', [{ purchaseType: 'boost', productId: selectedPackage.product.identifier }]);
        if (!result.success) throw new Error(result.error || 'Boost purchase could not be recorded.');
        notifySuccess();
        onClose();
        Alert.alert('Boost hazır ✦', 'Ek boost hesabına eklendi.');
      } else if (customerInfo.entitlements.active['MyTurn Pro']) {
        notifySuccess();
        onClose();
        Alert.alert('MyTurn Pro hazır ✦', 'Tüm Pro özellikleri hesabında aktif.');
      }
    } catch (error: any) {
      if (!error.userCancelled) Alert.alert('Satın alma tamamlanamadı', error.message);
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    if (restoring) return;
    lightTap();
    setRestoring(true);
    try {
      const customerInfo = await Purchases.restorePurchases();
      useProStore.getState().updateCustomerInfo(customerInfo);
      if (customerInfo.entitlements.active['MyTurn Pro']) {
        notifySuccess();
        onClose();
        Alert.alert('Satın alımlar geri yüklendi', 'Pro üyeliğin yeniden etkinleştirildi.');
      } else {
        Alert.alert('Aktif üyelik bulunamadı', 'Geri yüklenecek bir Pro üyeliği yok.');
      }
    } catch (error: any) {
      Alert.alert('Geri yüklenemedi', error.message);
    } finally {
      setRestoring(false);
    }
  };

  if (!isOpen) return null;

  const hasAnyPackages = Boolean(packages.annual || packages.monthly || packages.boost);

  return (
    <Modal visible={isOpen} animationType="none" transparent statusBarTranslucent>
      <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.backdrop}>
        <LinearGradient colors={['#151516', '#0d0d0e', '#050505']} style={StyleSheet.absoluteFill} />
        <Animated.View entering={SlideInDown.duration(280)} exiting={SlideOutDown.duration(220)} style={styles.screen}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 18), paddingBottom: Math.max(insets.bottom, 20) }]}
          >
            <View style={styles.topBar}>
              <View style={styles.proMark}>
                <Sparkles size={15} color={ACCENT} />
                <Text weight="bold" style={styles.proMarkText}>MYTURN PRO</Text>
              </View>
              <TouchableOpacity accessibilityLabel="Kapat" onPress={() => { lightTap(); onClose(); }} style={styles.closeButton}>
                <X size={18} color="rgba(255,255,255,0.72)" />
              </TouchableOpacity>
            </View>

            <View style={styles.hero}>
              <Text weight="bold" style={styles.title}>Daha fazlasını sakla.</Text>
              <Text style={styles.subtitle}>Daha yüksek kalite, daha uzun arşiv ve vlogların için daha fazla alan.</Text>
            </View>

            <View style={styles.benefits}>
              <Benefit icon={<View style={styles.qualityBadge}><Text weight="bold" style={styles.qualityText}>1080p</Text></View>} label="HD kalite" />
              <Benefit icon={<Cloud size={17} color={ACCENT} />} label="6 ay arşiv" />
              <Benefit icon={<InfinityIcon size={19} color={ACCENT} />} label="Sınırsız vlog" />
            </View>

            <View style={styles.moreBenefits}>
              <Text weight="bold" style={styles.moreBenefitsLabel}>Bunlar da dahil</Text>
              <Text style={styles.moreBenefitsText}>
                10 gruba kadar üyelik  ·  Özel temalar  ·  Her Pro aboneliğinde 1 boost dahil  ·  İstediğin zaman iptal
              </Text>
            </View>

            <View style={styles.divider} />

            {loadingOfferings ? (
              <View style={styles.loadingBox}><ActionProgress label="Planlar hazırlanıyor" /></View>
            ) : !hasAnyPackages ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>
                  Abonelik planları şu anda yüklenemedi. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.
                </Text>
                <TouchableOpacity onPress={() => void fetchOfferings()} style={styles.retryBtn} activeOpacity={0.8}>
                  <RefreshCw size={14} color="#000" />
                  <Text weight="bold" style={styles.retryText}>Tekrar Dene</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.plans}>
                {packages.annual && (
                  <PlanRow
                    title="Yıllık"
                    price={packages.annual.product.priceString || PRO_ANNUAL_PRICE}
                    period="/ yıl"
                    detail={`Aylık ${PRO_ANNUAL_MONTHLY_PRICE}`}
                    badge="EN AVANTAJLI"
                    selected={selectedPackage?.identifier === packages.annual.identifier}
                    onPress={() => { selectionTick(); setSelectedPackage(packages.annual); }}
                  />
                )}
                {packages.monthly && (
                  <PlanRow
                    title="Aylık"
                    price={packages.monthly.product.priceString || PRO_MONTHLY_PRICE}
                    period="/ ay"
                    detail="İstediğin zaman iptal et"
                    selected={selectedPackage?.identifier === packages.monthly.identifier}
                    onPress={() => { selectionTick(); setSelectedPackage(packages.monthly); }}
                  />
                )}
                {packages.boost && (
                  <PlanRow
                    title="Ek Boost"
                    price={packages.boost.product.priceString || (isPro ? PRO_BOOST_PRICE : FREE_BOOST_PRICE)}
                    period=" / adet"
                    detail={isPro ? 'Pro üyelerine özel fiyat' : 'Pro olmadan boost satın al'}
                    selected={selectedPackage?.identifier === packages.boost.identifier}
                    onPress={() => { selectionTick(); setSelectedPackage(packages.boost); }}
                  />
                )}
              </View>
            )}

            <TouchableOpacity
              onPress={handlePurchase}
              disabled={purchasing || !selectedPackage}
              activeOpacity={0.88}
              style={[styles.continueButton, (!selectedPackage || purchasing) && styles.disabledButton]}
            >
              {purchasing ? (
                <ActionProgress label="Güvenli ödeme açılıyor" color="#000" />
              ) : (
                <>
                  <Text weight="bold" style={styles.continueText}>{packages.boost?.identifier === selectedPackage?.identifier ? 'Boost satın al' : "Pro'ya Geç"}</Text>
                  <ChevronRight size={17} color="#000" strokeWidth={2.5} />
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.renewalNote}>Ödeme App Store / Google Play hesabından alınır. Abonelik iptal edilmediği sürece otomatik yenilenir.</Text>

            <View style={styles.footer}>
              <TouchableOpacity onPress={handleRestore} disabled={restoring}>
                {restoring ? <ActionProgress label="Geri yükleniyor" compact /> : <Text style={styles.footerLink}>Satın alımları geri yükle</Text>}
              </TouchableOpacity>
              <Text style={styles.footerDot}>•</Text>
              <TouchableOpacity><Text style={styles.footerLink}>Koşullar</Text></TouchableOpacity>
              <Text style={styles.footerDot}>•</Text>
              <TouchableOpacity><Text style={styles.footerLink}>Gizlilik</Text></TouchableOpacity>
            </View>
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

function Benefit({ icon, label }: { icon: React.ReactNode; label: string }) {
  return <View style={styles.benefit}>{icon}<Text weight="bold" style={styles.benefitText}>{label}</Text></View>;
}

function PlanRow({ title, price, period, detail, badge, selected, onPress }: {
  title: string; price: string; period: string; detail?: string; badge?: string; selected: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.86} style={[styles.planRow, selected && styles.planRowSelected]}>
      <View style={styles.planRadio}>{selected ? <CircleDot size={21} color={ACCENT} /> : <Circle size={21} color="rgba(255,255,255,0.25)" />}</View>
      <View style={styles.planCopy}>
        <View style={styles.planTitleRow}>
          <Text weight="bold" style={styles.planTitle}>{title}</Text>
          {badge && <View style={styles.planBadge}><Text weight="bold" style={styles.planBadgeText}>{badge}</Text></View>}
        </View>
        {detail && <Text style={styles.planDetail}>{detail}</Text>}
      </View>
      <View style={styles.priceRow}>
        <Text weight="bold" style={styles.price}>{price}</Text>
        <Text style={styles.period}>{period}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#050505' },
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 22 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  proMark: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  proMarkText: { color: ACCENT, fontSize: 11, letterSpacing: 1.4 },
  closeButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  hero: { marginTop: 25, marginBottom: 22 },
  title: { color: '#fff', fontSize: 28, letterSpacing: -0.8, lineHeight: 34 },
  subtitle: { color: 'rgba(255,255,255,0.52)', fontSize: 13, lineHeight: 19, marginTop: 7, maxWidth: 310 },
  benefits: { flexDirection: 'row', gap: 8 },
  benefit: { flex: 1, minHeight: 58, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.045)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', gap: 6 },
  benefitText: { color: 'rgba(255,255,255,0.72)', fontSize: 10 },
  qualityBadge: { borderWidth: 1, borderColor: ACCENT, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  qualityText: { color: ACCENT, fontSize: 8 },
  moreBenefits: { alignItems: 'center', marginTop: 14, paddingHorizontal: 8 },
  moreBenefitsLabel: { color: 'rgba(255,255,255,0.58)', fontSize: 10, marginBottom: 4 },
  moreBenefitsText: { color: 'rgba(255,255,255,0.34)', fontSize: 9.5, lineHeight: 15, textAlign: 'center' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginVertical: 18 },
  loadingBox: { height: 150, alignItems: 'center', justifyContent: 'center' },
  emptyBox: { padding: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  emptyText: { color: 'rgba(255,255,255,0.5)', fontSize: 12, textAlign: 'center', lineHeight: 18, marginBottom: 14 },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  retryText: { color: '#000', fontSize: 12 },
  plans: { gap: 10 },
  planRow: { minHeight: 76, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.045)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.07)', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' },
  planRowSelected: { borderColor: ACCENT, backgroundColor: 'rgba(224,124,48,0.075)' },
  planRadio: { width: 30 },
  planCopy: { flex: 1 },
  planTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  planTitle: { color: '#fff', fontSize: 14 },
  planBadge: { backgroundColor: ACCENT, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
  planBadgeText: { color: '#17100b', fontSize: 7, letterSpacing: 0.35 },
  planDetail: { color: 'rgba(255,255,255,0.38)', fontSize: 10, marginTop: 4 },
  priceRow: { alignItems: 'flex-end' },
  price: { color: '#fff', fontSize: 15 },
  period: { color: 'rgba(255,255,255,0.38)', fontSize: 9, marginTop: 2 },
  continueButton: { height: 52, borderRadius: 16, backgroundColor: ACCENT, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 20 },
  disabledButton: { opacity: 0.4 },
  continueText: { color: '#000', fontSize: 14 },
  renewalNote: { color: 'rgba(255,255,255,0.28)', fontSize: 9, lineHeight: 13, textAlign: 'center', marginTop: 11, paddingHorizontal: 12 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 18 },
  footerLink: { color: 'rgba(255,255,255,0.38)', fontSize: 9 },
  footerDot: { color: 'rgba(255,255,255,0.18)', fontSize: 9 },
});