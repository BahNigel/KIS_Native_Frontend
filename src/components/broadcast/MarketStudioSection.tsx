import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, DeviceEventEmitter, Image, Pressable, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import Skeleton from '@/components/common/Skeleton';
import { deleteRequest } from '@/network/delete';
import { getRequest } from '@/network/get';
import { patchRequest } from '@/network/patch';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import { launchImageLibrary, Asset } from 'react-native-image-picker';
import { PickedImage } from '@/screens/tabs/profile/profile.types';

type Props = {
  profile: any;
  canUseMarket: boolean;
  onUpgrade?: () => void;
};

const parseTierLimit = (value: unknown) => {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === 'string') {
    const cleaned = value.trim().toLowerCase();
    if (cleaned === '' || cleaned === 'unlimited') {
      return null;
    }
  }
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return null;
  }
  return numeric;
};

const MARKET_DIFFERENTIATORS = [
  'Verified shop badges with analytics',
  'AI product descriptions & tag suggestions',
  'Global discovery feed with search, filters, and trending badges',
  'Auto-pricing alerts when competitors discount similar goods',
  'Custom storefront theming per shop',
  'Flash sale scheduling with countdown timers',
  'Multi-currency display + automatic conversion hints',
  'Bundled products (kits and collections)',
  'Customer reviews + verified order badges',
  'Dynamic shipping estimate builder',
  'Promo codes + loyalty point rules',
  'Live chat / broadcast integration for product drops',
  'Inventory alerts & restock reminders',
  'Abandoned cart recovery notes',
  'Revenue dashboards + payout exports',
];

const MARKET_ANALYTICS_FEATURES = [
  'Real-time revenue dashboards stratified by shop and partner tiers',
  'Credit flow snapshots (earned vs spent) updated every minute',
  'Geo + timezone heatmaps showing engagement spikes across regions',
  'Inventory velocity forecasting with auto-restock triggers',
  'AI-suggested pricing elasticity curves for premium drops',
  'Live conversion rates and attendee retention per broadcast',
  'Segmented subscription churn risk scoring by shop',
  'Automated compliance flags with VIP contact tracing',
  'Trend signals for credit-backed kit launches',
  'Sentiment analysis on product chatter and broadcast comments',
  'Revenue impact modelling for exclusive lessons or drops',
  'Creator ranking leaderboards by total credits generated',
  'Product bundling performance insights with ROI estimates',
  'Marketplace health overview including fraud & authenticity cues',
  'Follower growth and loyalty lift metrics across channels',
  'Custom KPI boards (sales, enrollments, credits) with share links',
  'Video + broadcast attribution per promoted product',
  'Auto-generated highlight reels summarizing credit peaks',
  'Audience geography matrix for global lesson attractions',
  'Actionable alerts for supply shortages or fulfillment delays',
];

const MARKET_POWER_FEATURES = [
  'Subscribe to product alerts and receive in-app credit notifications',
  'Join a shop to unlock exclusive drops, member-only feeds, and briefs',
  'Credit-only checkout keeps experience cash-free and auditable',
  'Broadcast-integrated carts let you buy while watching a drop',
  'Portfolio-based shop layouts with curated kit showcases',
  'Automated bundling suggestions for cross-shop exposure',
  'AI-backed authenticity badges with real-time verification',
  'Live fraud scoring plus moderation cues on every checkout',
  'Dynamic promo codes tied to loyalty tiers and analytics',
  'Community highlights for trending products and testimonials',
];

const PARTNER_PRO_HIGHLIGHTS = [
  'Unlimited partner organizations, automation rules, and access reviews',
  'Partner-grade exports + compliance dashboards',
  'Priority integrations, webhooks, and fraud insights',
  'Advanced partner analytics with broadcast attribution',
];

type MarketTabId = 'feed' | 'shops' | 'products' | 'analytics';

const MARKET_TABS: { id: MarketTabId; label: string }[] = [
  { id: 'feed', label: 'Global Feed' },
  { id: 'shops', label: 'Shops' },
  { id: 'products', label: 'Products' },
  { id: 'analytics', label: 'Analytics' },
];

export default function MarketStudioSection({ profile, canUseMarket, onUpgrade }: Props) {
  const { palette } = useKISTheme();
  const [shops, setShops] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [shopForm, setShopForm] = useState({
    name: '',
    slug: '',
    description: '',
  });
  const [productForm, setProductForm] = useState({
    name: '',
    price: '',
    currency: 'USD',
    description: '',
    inventory_type: 'PHYSICAL',
    stock_qty: '0',
    imagePreview: '',
  });
  const [activeShopId, setActiveShopId] = useState<string | null>(null);
  const [editingShopId, setEditingShopId] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [marketplaceProducts, setMarketplaceProducts] = useState<any[]>([]);
  const [marketplaceLoading, setMarketplaceLoading] = useState(false);
  const [shopImage, setShopImage] = useState<PickedImage | null>(null);
  const [shopImagePreview, setShopImagePreview] = useState('');
  const [productImage, setProductImage] = useState<PickedImage | null>(null);
  const [productImagePreview, setProductImagePreview] = useState('');
  const [activeMarketTab, setActiveMarketTab] = useState<MarketTabId>('feed');

  const tierFeatures = useMemo(() => profile?.tier?.features_json ?? {}, [profile?.tier?.features_json]);
  const isMarketPro = Boolean(tierFeatures.market_pro_insights);
  const hasAnalyticsAccess = Boolean(tierFeatures.market_analytics);
  const isPartnerPro = Boolean(
    tierFeatures.partner_insight ||
      (typeof tierFeatures.partner_accounts === 'string' &&
        tierFeatures.partner_accounts.toLowerCase().includes('unlimited')),
  );
  const shopLimit = parseTierLimit(tierFeatures.shops_limit);
  const productLimit = parseTierLimit(tierFeatures.products_per_shop_limit);
  const canCreateShop = shopLimit === null || shops.length < shopLimit;
  const activeShop = useMemo(
    () => shops.find((shop) => shop.id === activeShopId) ?? shops[0] ?? null,
    [shops, activeShopId],
  );
  const productsForActiveShop = useMemo(() => {
    if (!activeShop) return [];
    return products.filter((product) => product.shop === activeShop.id);
  }, [activeShop, products]);
  const canAddProduct =
    Boolean(activeShop) && (productLimit === null || productsForActiveShop.length < productLimit);
  const shopUsage = shopLimit === null ? `${shops.length} shops created` : `${shops.length}/${shopLimit} shops`;
  const productUsage = activeShop
    ? productLimit === null
      ? `${productsForActiveShop.length} listings`
      : `${productsForActiveShop.length}/${productLimit} listings`
    : 'Create a shop to add products';
  const isEditingShop = Boolean(editingShopId);
  const isEditingProduct = Boolean(editingProductId);
  const editingShop = editingShopId ? shops.find((shop) => shop.id === editingShopId) ?? null : null;
  const editingProduct = editingProductId
    ? products.find((product) => product.id === editingProductId) ?? null
    : null;

  const resetShopForm = () => {
    setShopForm({ name: '', slug: '', description: '' });
    setEditingShopId(null);
    setShopImage(null);
    setShopImagePreview('');
  };

  const resetProductForm = () => {
    setProductForm({
      name: '',
      price: '',
      currency: 'USD',
      description: '',
      inventory_type: 'PHYSICAL',
      stock_qty: '0',
      imagePreview: '',
    });
    setEditingProductId(null);
    setProductImage(null);
    setProductImagePreview('');
  };

  const loadMarketplaceFeed = useCallback(async () => {
    setMarketplaceLoading(true);
    const res = await getRequest(ROUTES.commerce.products, {
      errorMessage: 'Unable to load marketplace products.',
    });
    if (res?.success) {
      const payload = Array.isArray(res.data) ? res.data : res.data?.results ?? res.data ?? [];
      setMarketplaceProducts(Array.isArray(payload) ? payload : []);
    }
    setMarketplaceLoading(false);
  }, []);

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

  const buildPickedImage = (asset: Asset | undefined, prefix: string): PickedImage | null => {
    if (!asset?.uri) return null;
    const extension = (asset.type || 'image/jpeg').split('/')[1] || 'jpg';
    const name = asset.fileName || `${prefix}_${Date.now()}.${extension}`;
    return {
      uri: asset.uri,
      name,
      type: asset.type || 'image/jpeg',
    };
  };

  const pickShopImage = useCallback(async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.85, selectionLimit: 1 });
    if (result.didCancel) return;
    const asset = result.assets?.[0];
    const picked = buildPickedImage(asset, 'shop');
    if (!picked) return;
    setShopImage(picked);
    setShopImagePreview(asset?.uri || '');
  }, []);

  const pickProductImage = useCallback(async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.85, selectionLimit: 1 });
    if (result.didCancel) return;
    const asset = result.assets?.[0];
    const picked = buildPickedImage(asset, 'product');
    if (!picked) return;
    setProductImage(picked);
    setProductImagePreview(asset?.uri || '');
    setProductForm((prev) => ({ ...prev, imagePreview: asset?.uri || '' }));
  }, []);

  useEffect(() => {
    loadMarketplaceFeed();
  }, [loadMarketplaceFeed]);

  useEffect(() => {
    if (canUseMarket) {
      loadMarket();
    }
  }, [canUseMarket, loadMarket]);

  useEffect(() => {
    if (!shops.length) {
      setActiveShopId(null);
      return;
    }
    if (!activeShopId || !shops.some((shop) => shop.id === activeShopId)) {
      setActiveShopId(shops[0].id);
    }
  }, [shops, activeShopId]);

  useEffect(() => {
    if (editingShop && editingShopId) {
      setShopForm({
        name: editingShop.name,
        slug: editingShop.slug,
        description: editingShop.description || '',
      });
      setShopImagePreview(editingShop.image_url || '');
      setShopImage(null);
    }
  }, [editingShop, editingShopId]);

  useEffect(() => {
    if (editingProduct && editingProductId) {
      setProductForm({
        name: editingProduct.name,
        price: String(editingProduct.price),
        currency: editingProduct.currency || 'USD',
        description: editingProduct.description || '',
        inventory_type: editingProduct.inventory_type || 'PHYSICAL',
        stock_qty: String(editingProduct.stock_qty ?? 0),
        imagePreview: editingProduct.image_url || '',
      });
      setProductImage(null);
      setProductImagePreview(editingProduct.image_url || '');
    }
  }, [editingProduct, editingProductId]);

  const handleShopSubmit = useCallback(async () => {
    if (!shopForm.name || !shopForm.slug) {
      Alert.alert('Market', 'Shop name and slug are required.');
      return;
    }
    if (!isEditingShop && !canCreateShop) {
      Alert.alert('Market', 'You have reached your shop limit.');
      return;
    }
    const shopData = new FormData();
    shopData.append('name', shopForm.name.trim());
    shopData.append('slug', shopForm.slug.toLowerCase());
    shopData.append('description', shopForm.description.trim());
    if (shopImage) {
      shopData.append('image_file', {
        uri: shopImage.uri,
        name: shopImage.name,
        type: shopImage.type,
      } as any);
    }
    const url = isEditingShop ? `${ROUTES.commerce.shops}${editingShopId}/` : ROUTES.commerce.shops;
    const method = isEditingShop ? patchRequest : postRequest;
    const res = await method(url, shopData, {
      errorMessage: isEditingShop ? 'Unable to update shop.' : 'Unable to create shop.',
    });
    if (res?.success) {
      resetShopForm();
      loadMarket();
    }
  }, [shopForm, isEditingShop, editingShopId, canCreateShop, loadMarket, shopImage]);

  const handleProductSubmit = useCallback(async () => {
    if (!productForm.name || !productForm.price) {
      Alert.alert('Market', 'Product name and price are required.');
      return;
    }
    const targetShopId = editingProduct ? editingProduct.shop : activeShop?.id;
    if (!targetShopId) {
      Alert.alert('Market', 'Create a shop before adding products.');
      return;
    }
    if (!isEditingProduct && !canAddProduct) {
      Alert.alert('Market', 'You have reached your product limit for this shop.');
      return;
    }
    if (!isEditingProduct && !productImage) {
      Alert.alert('Market', 'Product image is required.');
      return;
    }
    const form = new FormData();
    form.append('shop', targetShopId);
    form.append('sku', `${targetShopId}-${Date.now()}`);
    form.append('name', productForm.name);
    form.append('slug', `${productForm.name}`.toLowerCase().replace(/\s+/g, '-'));
    form.append('description', productForm.description);
    form.append('price', productForm.price);
    form.append('currency', productForm.currency);
    form.append('inventory_type', productForm.inventory_type);
    form.append('stock_qty', String(Number(productForm.stock_qty || 0)));
    if (productImage) {
      form.append('image_file', {
        uri: productImage.uri,
        name: productImage.name,
        type: productImage.type,
      } as any);
    }
    const url = isEditingProduct
      ? `${ROUTES.commerce.products}${editingProductId}/`
      : ROUTES.commerce.products;
    const method = isEditingProduct ? patchRequest : postRequest;
    const res = await method(url, form, {
      errorMessage: isEditingProduct ? 'Unable to update product.' : 'Unable to add product.',
    });
    if (res?.success) {
      resetProductForm();
      loadMarket();
    }
  }, [
    productForm,
    editingProduct,
    activeShop,
    isEditingProduct,
    editingProductId,
    canAddProduct,
    loadMarket,
    productImage,
  ]);

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

  const handleDeleteShop = useCallback(
    async (shopId: string) => {
      const res = await deleteRequest(`${ROUTES.commerce.shops}${shopId}/`, {
        errorMessage: 'Unable to delete shop.',
      });
      if (res?.success) {
        loadMarket();
      }
    },
    [loadMarket],
  );

  const handleDeleteProduct = useCallback(
    async (productId: string) => {
      const res = await deleteRequest(`${ROUTES.commerce.products}${productId}/`, {
        errorMessage: 'Unable to delete product.',
      });
      if (res?.success) {
        loadMarket();
      }
    },
    [loadMarket],
  );

  const handleShopEdit = useCallback(
    (shop: any) => {
      setActiveShopId(shop.id);
      setEditingShopId(shop.id);
      setShopForm({
        name: shop.name,
        slug: shop.slug,
        description: shop.description || '',
      });
    },
    [],
  );

  const handleProductEdit = useCallback(
    (product: any) => {
      setActiveShopId(product.shop);
      setEditingProductId(product.id);
      setProductForm({
        name: product.name,
        price: String(product.price),
        currency: product.currency || 'USD',
        description: product.description || '',
        inventory_type: product.inventory_type || 'PHYSICAL',
        stock_qty: String(product.stock_qty ?? 0),
        image_url: product.image_url || '',
      });
    },
    [],
  );

  const cancelShopEdit = () => resetShopForm();
  const cancelProductEdit = () => resetProductForm();

  const handleProductSubscribe = useCallback(
    async (productId: string) => {
      const res = await postRequest(
        ROUTES.commerce.productSubscribe(productId),
        {},
        { errorMessage: 'Unable to subscribe to product.' },
      );
      if (res?.success) {
        Alert.alert('Market', 'You will receive credit alerts when this listing updates.');
        loadMarketplaceFeed();
      }
    },
    [loadMarketplaceFeed],
  );

  const handleJoinShop = useCallback(
    async (shopId: string) => {
      if (!shopId) {
        Alert.alert('Market', 'Shop identifier missing.');
        return;
      }
      const res = await postRequest(
        ROUTES.commerce.shopJoin(shopId),
        {},
        { errorMessage: 'Unable to join shop.' },
      );
      if (res?.success) {
        Alert.alert('Market', 'Shop membership granted; notifications will follow.');
        loadMarket();
        loadMarketplaceFeed();
      }
    },
    [loadMarket, loadMarketplaceFeed],
  );

  if (!canUseMarket) {
    return (
      <View style={{ borderWidth: 1, borderColor: palette.divider, borderRadius: 16, padding: 14 }}>
        <Text style={{ color: palette.text, fontWeight: '700' }}>Marketplace studio</Text>
        <Text style={{ color: palette.subtext, marginTop: 6 }}>
          Upgrade to a Business tier to open a shop, manage listings, and broadcast products.
        </Text>
        <KISButton title="Upgrade to Business" onPress={onUpgrade ?? (() => {})} style={{ marginTop: 10 }} />
        <View style={{ marginTop: 14, gap: 6 }}>
          <Text style={{ color: palette.text, fontWeight: '700' }}>What you gain</Text>
          {MARKET_DIFFERENTIATORS.map((feature) => (
            <Text key={feature} style={{ color: palette.subtext, fontSize: 12 }}>
              • {feature}
            </Text>
          ))}
        </View>
      </View>
    );
  }

  const renderFeedTab = () => (
    <View style={{ gap: 10 }}>
      <View style={{ gap: 6 }}>
        <Text style={{ color: palette.text, fontWeight: '700', fontSize: 18 }}>Marketplace feed</Text>
        <Text style={{ color: palette.subtext }}>
          Browse verified listings that can be filtered, shared, or promoted. Product subscriptions deliver in-app credit updates.
        </Text>
      </View>
      {marketplaceLoading ? (
        <View style={{ marginTop: 12, gap: 10 }}>
          <Skeleton height={100} radius={14} />
          <Skeleton height={100} radius={14} />
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {marketplaceProducts.slice(0, 4).map((product) => (
            <View
              key={product.id}
              style={{
                borderWidth: 1,
                borderColor: palette.divider,
                borderRadius: 14,
                padding: 12,
                gap: 8,
              }}
            >
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                {product.image_url ? (
                  <Image
                    source={{ uri: product.image_url }}
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 12,
                      backgroundColor: palette.surface,
                    }}
                  />
                ) : (
                  <View
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 12,
                      backgroundColor: palette.surfaceElevated,
                    }}
                  />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: palette.text, fontWeight: '600' }}>{product.name}</Text>
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>
                    {product.price} {product.currency}
                  </Text>
                  <Text style={{ color: palette.subtext, fontSize: 11 }}>
                    Shop: {product.shop_name ?? 'Independent'} · Stock: {product.stock_qty ?? 0}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <KISButton title="Subscribe" size="sm" onPress={() => handleProductSubscribe(product.id)} />
                <KISButton
                  title="Join shop"
                  size="sm"
                  variant="secondary"
                  onPress={() => handleJoinShop(product.shop)}
                />
              </View>
              <Text style={{ color: palette.subtext, fontSize: 12 }}>
                All transactions settle in credits; keep wallets funded so customers can check out instantly.
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const renderShopTab = () => (
    <View style={{ gap: 14, borderWidth: 1, borderColor: palette.divider, borderRadius: 16, padding: 14 }}>
      <Text style={{ color: palette.text, fontWeight: '700' }}>Shop management</Text>
      <Text style={{ color: palette.subtext, fontSize: 12 }}>
        Build, update, or remove stores and track membership limits with real-time refreshes.
      </Text>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', marginTop: 8 }}>
        <KISButton title={shopImagePreview ? 'Update shop image' : 'Choose shop image'} size="sm" onPress={pickShopImage} />
        {shopImagePreview ? (
          <Image
            source={{ uri: shopImagePreview }}
            style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: palette.surface }}
          />
        ) : (
          <Text style={{ color: palette.subtext, fontSize: 12 }}>Image required for shop</Text>
        )}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <KISButton
          title="Refresh data"
          size="sm"
          onPress={() => {
            loadMarket();
            loadMarketplaceFeed();
          }}
        />
      </View>
      {shops.length === 0 ? (
        <Text style={{ color: palette.subtext }}>You don't have a shop yet.</Text>
      ) : (
        <View style={{ gap: 8 }}>
          {shops.map((shop) => {
            const isActive = activeShop && shop.id === activeShop.id;
            return (
              <View
                key={shop.id}
                style={{
                  borderWidth: 1,
                  borderColor: isActive ? palette.primary : palette.divider,
                  borderRadius: 12,
                  padding: 12,
                  backgroundColor: isActive ? palette.primarySoft : palette.surface,
                }}
              >
                  {shop.image_url ? (
                    <Image
                      source={{ uri: shop.image_url }}
                      style={{ width: 48, height: 48, borderRadius: 10, marginBottom: 4 }}
                    />
                  ) : (
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 10,
                        backgroundColor: palette.surfaceElevated,
                        marginBottom: 4,
                      }}
                    />
                  )}
                  <Text style={{ color: palette.text, fontWeight: '600' }}>{shop.name}</Text>
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>{shop.description}</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <KISButton title="Select" size="sm" onPress={() => setActiveShopId(shop.id)} />
                  <KISButton title="Edit" size="sm" variant="secondary" onPress={() => handleShopEdit(shop)} />
                  <KISButton
                    title="Delete"
                    size="sm"
                    variant="secondary"
                    onPress={() =>
                      Alert.alert(
                        'Delete shop',
                        'Are you sure you want to remove this shop and all its listings?',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Delete', style: 'destructive', onPress: () => handleDeleteShop(shop.id) },
                        ],
                      )
                    }
                  />
                </View>
              </View>
            );
          })}
        </View>
      )}
      <Text style={{ color: palette.subtext, fontSize: 12 }}>Shop limit: {shopLimit === null ? 'Unlimited' : shopUsage}</Text>
      <KISTextInput
        label={isEditingShop ? 'Update store name' : 'Store name'}
        value={shopForm.name}
        onChangeText={(t) => setShopForm((prev) => ({ ...prev, name: t }))}
      />
      <KISTextInput
        label={isEditingShop ? 'Update slug' : 'Store slug'}
        value={shopForm.slug}
        onChangeText={(t) => setShopForm((prev) => ({ ...prev, slug: t.toLowerCase().replace(/\s+/g, '-') }))}
      />
      <KISTextInput
        label="Description"
        value={shopForm.description}
        onChangeText={(t) => setShopForm((prev) => ({ ...prev, description: t }))}
        multiline
        style={{ minHeight: 80 }}
      />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <KISButton
          title={isEditingShop ? 'Update shop' : 'Create shop'}
          onPress={handleShopSubmit}
          disabled={!isEditingShop && !canCreateShop}
        />
        {isEditingShop && (
          <KISButton title="Cancel" variant="secondary" size="sm" onPress={cancelShopEdit} />
        )}
      </View>
      {!isEditingShop && shopLimit !== null && !canCreateShop && (
        <Text style={{ color: palette.subtext, fontSize: 12 }}>
          Reach your shop limit ({shopLimit}). Upgrade to Business Pro for unlimited stores.
        </Text>
      )}
    </View>
  );

  const renderProductTab = () => (
    <View style={{ gap: 14, borderWidth: 1, borderColor: palette.divider, borderRadius: 16, padding: 14 }}>
      <Text style={{ color: palette.text, fontWeight: '700' }}>Product catalog</Text>
      <Text style={{ color: palette.subtext, fontSize: 12 }}>
        Add, edit, or delete listings for the active shop — every item needs an image and is settled in credits.
      </Text>
      <Text style={{ color: palette.subtext, fontSize: 12 }}>Product limit: {productLimit === null ? 'Unlimited' : productUsage}</Text>
      <KISTextInput
        label={isEditingProduct ? 'Edit product name' : 'Product name'}
        value={productForm.name}
        onChangeText={(t) => setProductForm((prev) => ({ ...prev, name: t }))}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <KISButton title="Select product image" size="sm" onPress={pickProductImage} />
        {productImagePreview ? (
          <Image
            source={{ uri: productImagePreview }}
            style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: palette.surface }}
          />
        ) : (
          <Text style={{ color: palette.subtext, fontSize: 12 }}>Image required</Text>
        )}
      </View>
      <KISTextInput
        label="Price (in credits)"
        value={productForm.price}
        onChangeText={(t) => setProductForm((prev) => ({ ...prev, price: t }))}
        keyboardType="decimal-pad"
      />
      <Text style={{ color: palette.subtext, fontSize: 11 }}>
        All commerce flows settle in credits, giving you a predictable ledger instead of cash.
      </Text>
      <KISTextInput
        label="Currency"
        value={productForm.currency}
        onChangeText={(t) => setProductForm((prev) => ({ ...prev, currency: t.toUpperCase() }))}
      />
      <KISTextInput
        label="Description"
        value={productForm.description}
        onChangeText={(t) => setProductForm((prev) => ({ ...prev, description: t }))}
        multiline
        style={{ minHeight: 80 }}
      />
      <KISTextInput
        label="Stock quantity"
        value={productForm.stock_qty}
        onChangeText={(t) => setProductForm((prev) => ({ ...prev, stock_qty: t }))}
        keyboardType="number-pad"
      />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <KISButton
          title={isEditingProduct ? 'Update product' : 'Add product'}
          onPress={handleProductSubmit}
          disabled={!isEditingProduct && !canAddProduct}
        />
        {isEditingProduct && (
          <KISButton title="Cancel" variant="secondary" size="sm" onPress={cancelProductEdit} />
        )}
      </View>
      {!isEditingProduct && productLimit !== null && !canAddProduct && (
        <Text style={{ color: palette.subtext, fontSize: 12 }}>
          You've maxed {productLimit} items for this shop. Upgrade to Business Pro for a larger catalog.
        </Text>
      )}
      <View style={{ gap: 10 }}>
        <Text style={{ color: palette.text, fontWeight: '700' }}>Manage listings</Text>
        {productsForActiveShop.length === 0 ? (
          <Text style={{ color: palette.subtext }}>Add items to see them here.</Text>
        ) : (
          productsForActiveShop.map((product) => (
            <View
              key={product.id}
              style={{
                borderWidth: 1,
                borderColor: palette.divider,
                borderRadius: 12,
                padding: 12,
                gap: 6,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: palette.text, fontWeight: '600' }}>{product.name}</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <KISButton title="Edit" size="sm" variant="secondary" onPress={() => handleProductEdit(product)} />
                  <KISButton
                    title="Delete"
                    size="sm"
                    variant="secondary"
                    onPress={() =>
                      Alert.alert(
                        'Delete product',
                        'Remove this listing and stop broadcasting it.',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: () => handleDeleteProduct(product.id),
                          },
                        ],
                      )
                    }
                  />
                </View>
              </View>
              <Text style={{ color: palette.subtext, fontSize: 12 }}>
                {product.price} {product.currency} · Stock: {product.stock_qty ?? 0}
              </Text>
              <KISButton title="Broadcast" size="sm" onPress={() => handleBroadcastProduct(product.id)} />
            </View>
          ))
        )}
      </View>
    </View>
  );

  const renderAnalyticsTab = () => (
    <View style={{ gap: 14, borderWidth: 1, borderColor: palette.divider, borderRadius: 16, padding: 14 }}>
      <Text style={{ color: palette.text, fontWeight: '700' }}>Market intelligence</Text>
      <Text style={{ color: palette.subtext, fontSize: 12 }}>
        {hasAnalyticsAccess
          ? 'Market analytics are active; every insight taps into your partner tiers.'
          : 'Upgrade to Business Pro and unlock Market Pro intelligence + alerts.'}
      </Text>
      <View style={{ gap: 6 }}>
        {MARKET_ANALYTICS_FEATURES.map((feature) => (
          <Text key={feature} style={{ color: palette.subtext, fontSize: 12 }}>
            • {feature}
          </Text>
        ))}
      </View>
      <View style={{ gap: 6, marginTop: 10 }}>
        <Text style={{ color: palette.text, fontWeight: '700' }}>Power features</Text>
        {MARKET_POWER_FEATURES.map((feature) => (
          <Text key={feature} style={{ color: palette.subtext, fontSize: 12 }}>
            • {feature}
          </Text>
        ))}
      </View>
      <View style={{ gap: 6, marginTop: 10 }}>
        <Text style={{ color: palette.text, fontWeight: '700' }}>Studio differentiators</Text>
        {MARKET_DIFFERENTIATORS.map((feature) => (
          <Text key={feature} style={{ color: palette.subtext, fontSize: 12 }}>
            • {feature}
          </Text>
        ))}
      </View>
      {!isMarketPro && (
        <KISButton
          title="Unlock Market Pro"
          onPress={onUpgrade ?? (() => {})}
          style={{ marginTop: 12 }}
        />
      )}
    </View>
  );

  return (
    <View style={{ marginTop: 12, gap: 12 }}>
      <View
        style={{
          borderWidth: 1,
          borderColor: palette.divider,
          borderRadius: 16,
          padding: 14,
          gap: 6,
          backgroundColor: palette.surface,
        }}
      >
        <Text style={{ fontWeight: '700', color: palette.text }}>Partner Pro focus</Text>
        <Text style={{ color: palette.subtext, fontSize: 12 }}>
          Partner Pro powers unlimited partners, compliance flags, automations, and advanced exports for your studios.
        </Text>
        <View style={{ gap: 4 }}>
          {PARTNER_PRO_HIGHLIGHTS.map((item) => (
            <Text key={item} style={{ color: palette.subtext, fontSize: 12 }}>
              • {item}
            </Text>
          ))}
        </View>
        {!isPartnerPro && (
          <KISButton title="Upgrade to Partner Pro" variant="outline" onPress={() => onUpgrade?.()} />
        )}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {MARKET_TABS.map((tab) => {
          const isActive = activeMarketTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => setActiveMarketTab(tab.id)}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 14,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: isActive ? palette.primary : palette.divider,
                backgroundColor: isActive ? palette.primarySoft : palette.surface,
              }}
            >
              <Text style={{ color: isActive ? palette.primaryStrong : palette.text, fontWeight: '700' }}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {activeMarketTab === 'feed' && renderFeedTab()}
      {activeMarketTab === 'shops' && renderShopTab()}
      {activeMarketTab === 'products' && renderProductTab()}
      {activeMarketTab === 'analytics' && renderAnalyticsTab()}
    </View>
  );
}
