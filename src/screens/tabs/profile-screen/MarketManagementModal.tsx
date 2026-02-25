import React from 'react';
import { ScrollView, Text, View, Alert } from 'react-native';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import type { KISPalette } from '@/theme/constants';
import { styles } from '../profile/profile.styles';
import { MARKET_MANAGEMENT_FEATURES } from './constants';
import { countProducts } from './helpers';
import type { MarketFormState } from './types';
import { ManagementAttachments } from './ManagementAttachments';

export type MarketManagementModalProps = {
  palette: KISPalette;
  title: string;
  subtitle: string;
  shops: any[];
  marketForm: MarketFormState;
  marketFormMode: 'add' | 'edit';
  marketFormLoading: boolean;
  beginMarketEdit: (shop: any) => void;
  handleMarketFormSave: () => Promise<void>;
  handleMarketFormDelete: () => Promise<void>;
  resetMarketForm: () => void;
  onMarketFormNameChange: (value: string) => void;
  onMarketFormProductsChange: (value: string) => void;
  attachments: any[];
  panelAttachmentUploading: boolean;
  handleAttachProfileFile: () => Promise<void>;
  onOpenLandingBuilder?: () => void;
};

export function MarketManagementModal(props: MarketManagementModalProps) {
  const {
    palette,
    title,
    subtitle,
    shops,
    marketForm,
    marketFormMode,
    marketFormLoading,
    beginMarketEdit,
    handleMarketFormSave,
    handleMarketFormDelete,
    resetMarketForm,
    onMarketFormNameChange,
    onMarketFormProductsChange,
    attachments,
    panelAttachmentUploading,
    handleAttachProfileFile,
    onOpenLandingBuilder,
  } = props;

  const shopCount = shops.length;
  const productCount = countProducts(shops);
  const extraShops = Math.max(0, shopCount - 5);
  const extraProducts = shops.reduce((sum, shop) => {
    const qty = Array.isArray(shop?.products) ? shop.products.length : 0;
    return sum + Math.max(0, qty - 20);
  }, 0);
  const creditUsage = extraShops * 5 + extraProducts * 2;

  return (
    <ScrollView contentContainerStyle={styles.managementPanelBody}>
      <View>
        <Text style={[styles.managementPanelTitle, { color: palette.text }]}>{title}</Text>
        <Text style={[styles.managementPanelSubtitle, { color: palette.subtext }]}>{subtitle}</Text>
        {onOpenLandingBuilder ? (
          <View style={{ marginTop: 8 }}>
            <KISButton title="Manage Landing Page" size="sm" variant="outline" onPress={onOpenLandingBuilder} />
          </View>
        ) : null}
      </View>
      <View style={styles.managementStatsRow}>
        <View style={styles.managementStat}>
          <Text style={[styles.managementStatValue, { color: palette.text }]}>{shopCount}</Text>
          <Text style={[styles.managementStatLabel, { color: palette.subtext }]}>Shops</Text>
        </View>
        <View style={styles.managementStat}>
          <Text style={[styles.managementStatValue, { color: palette.text }]}>{productCount}</Text>
          <Text style={[styles.managementStatLabel, { color: palette.subtext }]}>Products</Text>
        </View>
        <View style={styles.managementStat}>
          <Text style={[styles.managementStatValue, { color: palette.text }]}>{creditUsage} credits</Text>
          <Text style={[styles.managementStatLabel, { color: palette.subtext }]}>Extra capacity</Text>
        </View>
      </View>
      <View style={{ gap: 10 }}>
        {shops.map((shop, index) => (
          <View
            key={`${shop.name}-${index}`}
            style={[
              styles.managementItemCard,
              { borderColor: palette.divider, backgroundColor: palette.surface },
            ]}
          >
            <Text style={[styles.managementItemTitle, { color: palette.text }]}>{shop.name}</Text>
            <Text style={[styles.managementItemMeta, { color: palette.subtext }]}> 
              {Array.isArray(shop?.products)
                ? `${shop.products.length} products`
                : 'Product slots not defined'}
            </Text>
            <Text style={[styles.managementItemMeta, { color: palette.subtext }]}> 
              {`${extraProducts} extras used`}
            </Text>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
              <KISButton
                size="xs"
                variant="outline"
                title="Edit"
                onPress={() => beginMarketEdit(shop)}
              />
            </View>
          </View>
        ))}
        <View style={[styles.managementFeatureList, { borderColor: palette.divider }]}> 
          {MARKET_MANAGEMENT_FEATURES.map((feature) => (
            <Text key={feature} style={[styles.managementFeatureItem, { color: palette.text }]}> 
              • {feature}
            </Text>
          ))}
        </View>
      </View>
      <View
        style={[
          styles.managementForm,
          { borderColor: palette.divider, backgroundColor: palette.card },
        ]}
      >
        <Text style={[styles.managementFormLabel, { color: palette.text }]}> 
          {marketFormMode === 'edit' ? 'Update shop' : 'Add shop'}
        </Text>
        <KISTextInput
          label="Shop name"
          value={marketForm.name}
          onChangeText={onMarketFormNameChange}
        />
        <KISTextInput
          label="Product slots"
          value={marketForm.products}
          onChangeText={onMarketFormProductsChange}
          keyboardType="numeric"
        />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <KISButton
            title={marketFormMode === 'edit' ? 'Update shop' : 'Add shop'}
            onPress={handleMarketFormSave}
            disabled={marketFormLoading}
          />
          {marketFormMode === 'edit' && (
            <KISButton
              title="Delete shop"
              variant="outline"
              onPress={handleMarketFormDelete}
              disabled={marketFormLoading}
            />
          )}
        </View>
        <KISButton
          title="Reset form"
          variant="secondary"
          onPress={resetMarketForm}
          disabled={marketFormLoading}
        />
      </View>
      <ManagementAttachments
        palette={palette}
        attachments={attachments}
        uploading={panelAttachmentUploading}
        onAddAttachment={handleAttachProfileFile}
      />
      <View style={styles.managementActionRow}>
        <KISButton
          title="Publish drop"
          onPress={() => Alert.alert('Market', 'Drop scheduled.')}
        />
        <KISButton
          title="Review credits"
          variant="outline"
          onPress={() => Alert.alert('Credits', 'Credit dashboard updated.')}
        />
      </View>
    </ScrollView>
  );
}
