import React, { useMemo, useState } from 'react';
import { Alert, Image, ScrollView, Text, View } from 'react-native';
import { launchImageLibrary, Asset } from 'react-native-image-picker';

import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';

import useMarketData from '@/screens/broadcast/market/hooks/useMarketData';
import { MarketProduct, MarketShop } from '@/screens/broadcast/market/api/market.types';

type PickedImage = { uri: string; name: string; type: string };

type Props = {
  ownerId?: string | null;
};

const buildPickedImage = (asset: Asset | undefined, prefix: string): PickedImage | null => {
  if (!asset?.uri) return null;
  const extension = (asset.type || 'image/jpeg').split('/')[1] || 'jpg';
  const name = asset.fileName || `${prefix}_${Date.now()}.${extension}`;
  return { uri: asset.uri, name, type: asset.type || 'image/jpeg' };
};

export default function MarketProductsPage({ ownerId = null }: Props) {
  const { palette } = useKISTheme();
  const {
    myShops,
    myProducts,
    loadingMine,
    reloadAll,
    createProduct,
    updateProduct,
    deleteProduct,
    broadcastProduct,
  } = useMarketData({ ownerId, q: '' });

  const [activeShopId, setActiveShopId] = useState<string | null>(null);
  const [editing, setEditing] = useState<MarketProduct | null>(null);

  const [productImage, setProductImage] = useState<PickedImage | null>(null);
  const [productImagePreview, setProductImagePreview] = useState<string>('');

  const [form, setForm] = useState({
    name: '',
    price: '',
    currency: 'USD',
    description: '',
    stock_qty: '0',
  });

  const activeShop: MarketShop | null = useMemo(() => {
    if (!myShops.length) return null;
    if (!activeShopId) return myShops[0] ?? null;
    return myShops.find((s) => s.id === activeShopId) ?? myShops[0] ?? null;
  }, [myShops, activeShopId]);

  const productsForActiveShop = useMemo(() => {
    if (!activeShop) return [];
    return myProducts.filter((p) => String(p.shop) === String(activeShop.id));
  }, [myProducts, activeShop]);

  const reset = () => {
    setEditing(null);
    setProductImage(null);
    setProductImagePreview('');
    setForm({ name: '', price: '', currency: 'USD', description: '', stock_qty: '0' });
  };

  const pickImage = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 1, selectionLimit: 1 });
    if (result.didCancel) return;
    const asset = result.assets?.[0];
    const picked = buildPickedImage(asset, 'product');
    if (!picked) return;
    setProductImage(picked);
    setProductImagePreview(asset?.uri || '');
  };

  const beginEdit = (p: MarketProduct) => {
    setEditing(p);
    setActiveShopId(String(p.shop ?? activeShop?.id ?? ''));
    setForm({
      name: p.name ?? '',
      price: p.price !== undefined && p.price !== null ? String(p.price) : '',
      currency: p.currency ?? 'USD',
      description: p.description ?? '',
      stock_qty: String(p.stock_qty ?? 0),
    });
    setProductImage(null);
    setProductImagePreview(p.image_url ?? '');
  };

  const submit = async () => {
    if (!form.name.trim() || !form.price.trim()) {
      Alert.alert('Market', 'Product name and price are required.');
      return;
    }
    const shopId = editing?.shop ?? activeShop?.id;
    if (!shopId) {
      Alert.alert('Market', 'Create a shop before adding products.');
      return;
    }
    if (!editing && !productImage) {
      Alert.alert('Market', 'Product image is required.');
      return;
    }

    const fd = new FormData();
    fd.append('shop', String(shopId));
    fd.append('sku', `${shopId}-${Date.now()}`);
    fd.append('name', form.name.trim());
    fd.append('slug', form.name.trim().toLowerCase().replace(/\s+/g, '-'));
    fd.append('description', form.description.trim());
    fd.append('price', form.price.trim());
    fd.append('currency', form.currency.trim().toUpperCase());
    fd.append('stock_qty', String(Number(form.stock_qty || 0)));

    if (productImage) {
      fd.append('image_file', { uri: productImage.uri, name: productImage.name, type: productImage.type } as any);
    }

    if (editing?.id) {
      const r = await updateProduct(editing.id, fd);
      if (r.ok) {
        reset();
        await reloadAll();
      }
      return;
    }

    const r = await createProduct(fd);
    if (r.ok) {
      reset();
      await reloadAll();
    }
  };

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
      <View style={{ paddingHorizontal: 12, gap: 12, paddingTop: 12 }}>
        <View style={{ borderWidth: 2, borderColor: palette.divider, backgroundColor: palette.card, borderRadius: 22, padding: 12, gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: palette.text, fontWeight: '900', fontSize: 18 }}>Products</Text>
            <Text onPress={reloadAll} style={{ color: palette.subtext, fontWeight: '900' }} suppressHighlighting>
              {loadingMine ? 'Loading…' : 'Refresh'}
            </Text>
          </View>

          <Text style={{ color: palette.subtext, fontWeight: '700', fontSize: 12 }}>
            Active shop: {activeShop?.name ?? 'None'}
          </Text>

          {myShops.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {myShops.map((s) => {
                const active = String(activeShop?.id) === String(s.id);
                return (
                  <Text
                    key={s.id}
                    onPress={() => setActiveShopId(s.id)}
                    suppressHighlighting
                    style={{
                      borderWidth: 2,
                      borderColor: active ? palette.primary : palette.divider,
                      backgroundColor: active ? palette.primarySoft : palette.surface,
                      borderRadius: 999,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      color: active ? palette.primaryStrong : palette.text,
                      fontWeight: '900',
                    }}
                  >
                    {s.name ?? 'Shop'}
                  </Text>
                );
              })}
            </View>
          ) : (
            <Text style={{ color: palette.subtext, fontWeight: '700' }}>Create a shop first.</Text>
          )}

          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
            <KISButton title="Select product image" size="sm" onPress={pickImage} />
            {productImagePreview ? (
              <Image source={{ uri: productImagePreview }} style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: palette.surface }} />
            ) : (
              <Text style={{ color: palette.subtext, fontWeight: '700', fontSize: 12 }}>Image required</Text>
            )}
          </View>

          <KISTextInput label="Product name" value={form.name} onChangeText={(t) => setForm((p) => ({ ...p, name: t }))} />
          <KISTextInput
            label="Price (credits)"
            value={form.price}
            onChangeText={(t) => setForm((p) => ({ ...p, price: t }))}
            keyboardType="decimal-pad"
          />
          <KISTextInput
            label="Currency"
            value={form.currency}
            onChangeText={(t) => setForm((p) => ({ ...p, currency: t }))}
          />
          <KISTextInput
            label="Description"
            value={form.description}
            onChangeText={(t) => setForm((p) => ({ ...p, description: t }))}
            multiline
            style={{ minHeight: 80 }}
          />
          <KISTextInput
            label="Stock quantity"
            value={form.stock_qty}
            onChangeText={(t) => setForm((p) => ({ ...p, stock_qty: t }))}
            keyboardType="number-pad"
          />

          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            <KISButton title={editing ? 'Update product' : 'Add product'} onPress={submit} />
            {editing ? <KISButton title="Cancel" size="sm" variant="secondary" onPress={reset} /> : null}
          </View>
        </View>

        <View style={{ borderWidth: 2, borderColor: palette.divider, backgroundColor: palette.card, borderRadius: 22, padding: 12, gap: 10 }}>
          <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>Manage listings</Text>

          {!productsForActiveShop.length ? (
            <Text style={{ color: palette.subtext, fontWeight: '700' }}>No products for this shop yet.</Text>
          ) : (
            <View style={{ gap: 10 }}>
              {productsForActiveShop.map((p) => (
                <View key={p.id} style={{ borderWidth: 2, borderColor: palette.divider, backgroundColor: palette.surface, borderRadius: 18, padding: 12, gap: 8 }}>
                  <Text style={{ color: palette.text, fontWeight: '900' }}>{p.name ?? 'Product'}</Text>
                  <Text style={{ color: palette.subtext, fontWeight: '700', fontSize: 12 }}>
                    {p.price ?? ''} {p.currency ?? ''} · Stock: {p.stock_qty ?? 0}
                  </Text>

                  <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                    <KISButton title="Edit" size="sm" variant="secondary" onPress={() => beginEdit(p)} />
                    <KISButton
                      title="Delete"
                      size="sm"
                      variant="secondary"
                      onPress={() =>
                        Alert.alert('Delete product', 'Remove this listing?', [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Delete', style: 'destructive', onPress: async () => { await deleteProduct(p.id); } },
                        ])
                      }
                    />
                    <KISButton
                      title="Broadcast"
                      size="sm"
                      onPress={async () => {
                        const r = await broadcastProduct(p.id);
                        if (r.ok) Alert.alert('Broadcast', 'Product added to broadcast.');
                      }}
                    />
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
