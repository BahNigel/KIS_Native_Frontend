import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, DeviceEventEmitter, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import Skeleton from '@/components/common/Skeleton';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';

type Props = {
  profile: any;
  canUseMarket: boolean;
  onUpgrade?: () => void;
};

export default function MarketStudioSection({ profile, canUseMarket, onUpgrade }: Props) {
  const { palette } = useKISTheme();
  const [shops, setShops] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [marketForm, setMarketForm] = useState({
    shopName: '',
    shopSlug: '',
    shopDescription: '',
    productName: '',
    productPrice: '',
    productCurrency: 'USD',
    productDescription: '',
    productInventoryType: 'PHYSICAL',
    productStock: '0',
  });

  const marketShop = shops[0] ?? null;

  const loadMarket = useCallback(async () => {
    if (!profile?.user?.id) return;
    setLoading(true);
    const ownerId = profile.user.id;
    const [shopsRes, productsRes] = await Promise.all([
      getRequest(`${ROUTES.commerce.shops}?owner=${ownerId}`, {
        errorMessage: 'Unable to load shops.',
      }),
      getRequest(`${ROUTES.commerce.products}?owner=${ownerId}`, {
        errorMessage: 'Unable to load products.',
      }),
    ]);
    const shopList = shopsRes?.data?.results ?? shopsRes?.data ?? shopsRes ?? [];
    const productList = productsRes?.data?.results ?? productsRes?.data ?? productsRes ?? [];
    setShops(Array.isArray(shopList) ? shopList : []);
    setProducts(Array.isArray(productList) ? productList : []);
    setLoading(false);
  }, [profile?.user?.id]);

  useEffect(() => {
    if (canUseMarket) {
      loadMarket();
    }
  }, [canUseMarket, loadMarket]);

  const handleCreateShop = async () => {
    if (!marketForm.shopName || !marketForm.shopSlug) {
      Alert.alert('Market', 'Shop name and slug are required.');
      return;
    }
    const res = await postRequest(
      ROUTES.commerce.shops,
      {
        name: marketForm.shopName,
        slug: marketForm.shopSlug,
        description: marketForm.shopDescription,
      },
      { errorMessage: 'Unable to create shop.' },
    );
    if (res?.success) {
      setMarketForm((prev) => ({ ...prev, shopName: '', shopSlug: '', shopDescription: '' }));
      loadMarket();
    }
  };

  const handleCreateProduct = async () => {
    if (!marketShop) return;
    if (!marketForm.productName || !marketForm.productPrice) {
      Alert.alert('Market', 'Product name and price are required.');
      return;
    }
    const res = await postRequest(
      ROUTES.commerce.products,
      {
        shop: marketShop.id,
        sku: `${marketShop.slug}-${Date.now()}`,
        name: marketForm.productName,
        slug: `${marketForm.productName}`.toLowerCase().replace(/\s+/g, '-'),
        description: marketForm.productDescription,
        price: marketForm.productPrice,
        currency: marketForm.productCurrency,
        inventory_type: marketForm.productInventoryType,
        stock_qty: Number(marketForm.productStock || 0),
      },
      { errorMessage: 'Unable to create product.' },
    );
    if (res?.success) {
      setMarketForm((prev) => ({
        ...prev,
        productName: '',
        productPrice: '',
        productDescription: '',
      }));
      loadMarket();
    }
  };

  const handleBroadcastProduct = async (productId: string) => {
    const res = await postRequest(
      ROUTES.commerce.productBroadcast(productId),
      {},
      { errorMessage: 'Unable to broadcast product.' },
    );
    if (res?.success) {
      Alert.alert('Broadcast', 'Product added to broadcast.');
      DeviceEventEmitter.emit('broadcast.refresh');
    }
  };

  if (!canUseMarket) {
    return (
      <View style={{ marginTop: 12 }}>
        <KISButton title="Upgrade to Business" onPress={onUpgrade ?? (() => {})} />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={{ marginTop: 12, gap: 10 }}>
        <Skeleton height={80} radius={12} />
      </View>
    );
  }

  return (
    <View style={{ marginTop: 12, gap: 16 }}>
      {!marketShop ? (
        <View style={{ gap: 10 }}>
          <Text style={{ color: palette.subtext }}>Create your private store.</Text>
          <KISTextInput
            label="Store name"
            value={marketForm.shopName}
            onChangeText={(t) => setMarketForm((s) => ({ ...s, shopName: t }))}
          />
          <KISTextInput
            label="Store slug"
            value={marketForm.shopSlug}
            onChangeText={(t) => setMarketForm((s) => ({ ...s, shopSlug: t.toLowerCase().replace(/\s+/g, '-') }))}
          />
          <KISTextInput
            label="Description"
            value={marketForm.shopDescription}
            onChangeText={(t) => setMarketForm((s) => ({ ...s, shopDescription: t }))}
            multiline
            style={{ minHeight: 80 }}
          />
          <KISButton title="Create store" onPress={handleCreateShop} />
        </View>
      ) : (
        <>
          <View style={{ gap: 6 }}>
            <Text style={{ color: palette.text, fontWeight: '700' }}>{marketShop.name}</Text>
            <Text style={{ color: palette.subtext, fontSize: 12 }}>{marketShop.description}</Text>
          </View>

          <View style={{ gap: 10 }}>
            <Text style={{ color: palette.subtext }}>Add a product</Text>
            <KISTextInput
              label="Product name"
              value={marketForm.productName}
              onChangeText={(t) => setMarketForm((s) => ({ ...s, productName: t }))}
            />
            <KISTextInput
              label="Price"
              value={marketForm.productPrice}
              onChangeText={(t) => setMarketForm((s) => ({ ...s, productPrice: t }))}
              keyboardType="decimal-pad"
            />
            <KISTextInput
              label="Currency"
              value={marketForm.productCurrency}
              onChangeText={(t) => setMarketForm((s) => ({ ...s, productCurrency: t.toUpperCase() }))}
            />
            <KISTextInput
              label="Description"
              value={marketForm.productDescription}
              onChangeText={(t) => setMarketForm((s) => ({ ...s, productDescription: t }))}
              multiline
              style={{ minHeight: 80 }}
            />
            <KISTextInput
              label="Stock quantity"
              value={marketForm.productStock}
              onChangeText={(t) => setMarketForm((s) => ({ ...s, productStock: t }))}
              keyboardType="number-pad"
            />
            <KISButton title="Add product" onPress={handleCreateProduct} />
          </View>

          <View style={{ gap: 10 }}>
            <Text style={{ color: palette.text, fontWeight: '700' }}>Your listings</Text>
            {products.length === 0 ? (
              <Text style={{ color: palette.subtext }}>No products yet.</Text>
            ) : (
              products.map((product) => (
                <View
                  key={product.id}
                  style={{
                    borderWidth: 1,
                    borderColor: palette.divider,
                    borderRadius: 12,
                    padding: 12,
                    flexDirection: 'row',
                    gap: 12,
                    alignItems: 'center',
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: palette.text, fontWeight: '600' }}>{product.name}</Text>
                    <Text style={{ color: palette.subtext, fontSize: 12 }}>
                      {product.price} {product.currency}
                    </Text>
                  </View>
                  <KISButton
                    title="Broadcast"
                    size="sm"
                    onPress={() => handleBroadcastProduct(product.id)}
                  />
                </View>
              ))
            )}
          </View>
        </>
      )}
    </View>
  );
}
