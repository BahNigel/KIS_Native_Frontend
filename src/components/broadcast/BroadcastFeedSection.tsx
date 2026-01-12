import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, DeviceEventEmitter, Modal, Share, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import ViewShot from 'react-native-view-shot';
import { useKISTheme } from '@/theme/useTheme';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES, { NEST_API_BASE_URL } from '@/network';
import BroadcastFeedCard, { type BroadcastFeedItem } from './BroadcastFeedCard';
import Skeleton from '@/components/common/Skeleton';
import ShareRenderer, { type SharePayload } from '@/components/feeds/ShareRenderer';
import { uploadFileToBackend } from '@/Module/ChatRoom/uploadFileToBackend';
import ChatRoomPage from '@/Module/ChatRoom/ChatRoomPage';

type SourceFilter = 'all' | 'channel' | 'community' | 'partner';

type Props = {
  onSubscribeChannel: (channelId: string) => Promise<void> | void;
  searchTerm?: string;
  filterSource?: SourceFilter;
};

export default function BroadcastFeedSection({
  onSubscribeChannel,
  searchTerm = '',
  filterSource = 'all',
}: Props) {
  const { palette } = useKISTheme();
  const navigation = useNavigation();
  const [broadcasts, setBroadcasts] = useState<BroadcastFeedItem[]>([]);
  const [loadingBroadcasts, setLoadingBroadcasts] = useState(false);
  const [commentChatVisible, setCommentChatVisible] = useState(false);
  const [commentChat, setCommentChat] = useState<{ item: BroadcastFeedItem; chat: any } | null>(null);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [sharePayload, setSharePayload] = useState<SharePayload | null>(null);
  const shareShotRef = useRef<ViewShot>(null);

  const normalizedSearch = (searchTerm || '').trim().toLowerCase();

  const filteredBroadcasts = useMemo(() => {
    return broadcasts.filter((item) => {
      let passesSource = true;
      const sourceType = item.source?.type?.toLowerCase();
      if (filterSource && filterSource !== 'all') {
        passesSource = sourceType === filterSource;
      }

      if (!passesSource) return false;

      if (!normalizedSearch) return true;
      const haystack = `${item.title || ''} ${item.text || ''} ${item.source?.name || ''}`
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [broadcasts, filterSource, normalizedSearch]);

  const loadBroadcasts = useCallback(async () => {
    setLoadingBroadcasts(true);
    const res = await getRequest(ROUTES.broadcasts.list, {
      errorMessage: 'Unable to load broadcasts.',
    });
    if (res?.success) {
      const payload = res.data?.results ?? res.data ?? [];
      setBroadcasts(Array.isArray(payload) ? payload : []);
    }
    setLoadingBroadcasts(false);
  }, []);

  useEffect(() => {
    loadBroadcasts();
  }, [loadBroadcasts]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('broadcast.refresh', () => {
      loadBroadcasts();
    });
    return () => sub.remove();
  }, [loadBroadcasts]);

  const captureShareImage = async (payload: SharePayload) => {
    setSharePayload(payload);
    await new Promise((resolve) => requestAnimationFrame(() => resolve(true)));
    await new Promise((resolve) => setTimeout(resolve, 60));
    const uri = await shareShotRef.current?.capture?.();
    setSharePayload(null);
    return uri as string | undefined;
  };

  const uploadShareAsset = async (uri: string) => {
    const token = await AsyncStorage.getItem('access_token');
    if (!token) return null;
    const attachment = await uploadFileToBackend({
      file: {
        uri,
        name: `kis-share-${Date.now()}.png`,
        type: 'image/png',
      },
      authToken: token,
      baseUrl: NEST_API_BASE_URL,
    });
    return attachment?.url ?? null;
  };

  const handleShare = async (item: BroadcastFeedItem) => {
    const text = item.text ?? item.styled_text?.text ?? item.product?.name ?? '';
    const attachment = Array.isArray(item.attachments) ? item.attachments[0] : null;
    const attachmentUrl = attachment?.url ?? attachment?.uri ?? null;
    const kind = attachment?.kind ?? attachment?.mimeType ?? '';
    const isImage = String(kind).includes('image');
    const watermarkColor = '#22C55E';
    const subtitle = item.source?.name ?? item.title ?? 'Broadcast';

    if (attachmentUrl && isImage) {
      const imageUri = await captureShareImage({
        mode: 'image',
        text,
        imageUri: attachmentUrl,
        watermarkColor,
        subtitle,
      });
      if (imageUri) {
        const url = await uploadShareAsset(imageUri);
        if (url) {
          await Share.share({ message: url, url });
          return;
        }
      }
    }

    const imageUri = await captureShareImage({
      mode: 'text',
      text: text || 'Shared from KIS',
      watermarkColor,
      subtitle,
    });
    if (imageUri) {
      const url = await uploadShareAsset(imageUri);
      if (url) {
        await Share.share({ message: url, url });
      }
    }
  };

  const handleLike = async (item: BroadcastFeedItem) => {
    const res = await postRequest(
      ROUTES.broadcasts.react(item.id),
      { emoji: '❤️' },
      { errorMessage: 'Unable to react.' },
    );
    if (!res?.success) return;
    const nextCount = res.data?.count ?? res?.count ?? item.reaction_count ?? 0;
    const reacted = res.data?.reacted ?? res?.reacted;
    setBroadcasts((prev) =>
      prev.map((b) =>
        b.id === item.id
          ? {
              ...b,
              reaction_count: nextCount,
              viewer_reaction: reacted ? '❤️' : null,
            }
          : b,
      ),
    );
  };

  const handleComment = async (item: BroadcastFeedItem) => {
    const res = await postRequest(
      ROUTES.broadcasts.commentRoom(item.id),
      {},
      { errorMessage: 'Unable to open comments.' },
    );
    const conversationId =
      res?.data?.conversation_id ??
      res?.data?.conversationId ??
      res?.data?.id;
    if (!conversationId) {
      Alert.alert('Comments', 'Unable to open comment thread.');
      return;
    }
    setCommentChat({
      item,
      chat: {
        id: conversationId,
        conversationId,
        name: 'Broadcast comments',
        title: 'Comments',
        isGroup: true,
        kind: 'group',
      },
    });
    setCommentChatVisible(true);
  };

  const handleJoinCommunity = async (item: BroadcastFeedItem) => {
    const communityId = item.source?.id;
    if (!communityId) return;
    const joinPolicy = item.source?.join_policy ?? 'request';
    const url =
      joinPolicy === 'open'
        ? ROUTES.community.join(String(communityId))
        : ROUTES.community.requestJoin(String(communityId));
    const res = await postRequest(url, {}, { errorMessage: 'Unable to join community.' });
    if (res?.success) {
      loadBroadcasts();
    }
  };

  const handleJoinPartner = async (item: BroadcastFeedItem) => {
    const partnerId = item.source?.id;
    if (!partnerId) return;
    const allowSubscribe = item.source?.allow_subscribe;
    const allowApply = item.source?.allow_apply;
    const url = allowSubscribe && !allowApply
      ? ROUTES.partners.subscribe(String(partnerId))
      : ROUTES.partners.apply(String(partnerId));
    const res = await postRequest(url, {}, { errorMessage: 'Unable to join partner.' });
    if (res?.success) {
      loadBroadcasts();
    }
  };

  const handleOpenSource = (item: BroadcastFeedItem) => {
    const source = item.source;
    if (!source) return;
    if (source.type === 'channel' && source.conversation_id) {
      DeviceEventEmitter.emit('chat.open', {
        conversationId: source.conversation_id,
        name: source.name ?? 'Channel',
        kind: 'channel',
      });
      navigation.navigate('Messages' as never);
      return;
    }
    if (source.type === 'community' && source.id) {
      DeviceEventEmitter.emit('chat.open', {
        id: String(source.id),
        name: source.name ?? 'Community',
        kind: 'community',
      });
      navigation.navigate('Messages' as never);
      return;
    }
    if (source.type === 'partner' && source.id) {
      DeviceEventEmitter.emit('partner.open', {
        partnerId: String(source.id),
        feed: 'general',
      });
      navigation.navigate('Partners' as never);
    }
  };

  return (
    <View style={{ marginTop: 12, gap: 12 }}>
      {loadingBroadcasts ? (
        <View style={{ marginTop: 12, gap: 10 }}>
          <Skeleton height={120} radius={12} />
          <Skeleton height={120} radius={12} />
        </View>
      ) : broadcasts.length === 0 ? (
        <Text style={{ color: palette.subtext }}>No broadcasts yet.</Text>
      ) : filteredBroadcasts.length === 0 ? (
        <Text style={{ color: palette.subtext }}>No broadcasts match this filter.</Text>
      ) : (
        filteredBroadcasts.map((item) => (
          <BroadcastFeedCard
            key={item.id}
            item={{
              ...item,
              comment_count: commentCounts[item.id] ?? item.comment_count ?? 0,
            }}
            onLike={() => handleLike(item)}
            onComment={() => handleComment(item)}
            onShare={() => handleShare(item)}
            onOpenSource={() => handleOpenSource(item)}
            onJoinSource={() => {
              if (item.source?.type === 'community') handleJoinCommunity(item);
              if (item.source?.type === 'partner') handleJoinPartner(item);
            }}
            onSubscribeChannel={() => {
              if (item.source?.type === 'channel' && item.source?.id) {
                onSubscribeChannel(String(item.source.id));
              }
            }}
            onOpenMarket={() => Alert.alert('Market', 'Storefront details coming next.')}
          />
        ))
      )}

      <ShareRenderer ref={shareShotRef} payload={sharePayload} />

      <Modal
        visible={commentChatVisible}
        animationType="slide"
        onRequestClose={() => setCommentChatVisible(false)}
      >
        {commentChat ? (
          <ChatRoomPage
            chat={commentChat.chat}
            onBack={() => setCommentChatVisible(false)}
            allChats={[]}
            headerContextLabel={`Broadcast: ${
              commentChat.item.text ?? commentChat.item.styled_text?.text ?? commentChat.item.title
            }`}
            onPressHeaderContext={() => handleOpenSource(commentChat.item)}
            showMessageCount
            messageCountLabel="comments"
            onMessageCountChange={(count) => {
              setCommentCounts((prev) => ({ ...prev, [commentChat.item.id]: count }));
            }}
          />
        ) : null}
      </Modal>
    </View>
  );
}
