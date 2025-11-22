// src/screens/tabs/PartnersCenterPane.tsx
import React from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import styles from './partnersStyles';
import { useKISTheme } from '../../theme/useTheme';
import {
  Partner,
  PartnerCommunity,
  PartnerGroup,
  RIGHT_PEEK_WIDTH,
} from './partnersTypes';

type Props = {
  selectedPartner: Partner;
  selectedGroupId: string | null;
  rootGroups: PartnerGroup[];
  groupsForPartner: PartnerGroup[];
  communitiesForPartner: PartnerCommunity[];
  expandedCommunities: Record<string, boolean>;
  onToggleCommunity: (communityId: string) => void;
  onGroupPress: (groupId: string) => void;
  onPartnerHeaderPress: () => void;
};

export default function PartnersCenterPane({
  selectedPartner,
  selectedGroupId,
  rootGroups,
  groupsForPartner,
  communitiesForPartner,
  expandedCommunities,
  onToggleCommunity,
  onGroupPress,
  onPartnerHeaderPress,
}: Props) {
  const { palette } = useKISTheme();

  return (
    <View
      style={[
        styles.centerPane,
        {
          marginRight: RIGHT_PEEK_WIDTH,
        },
      ]}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.centerScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Partner header */}
        <View style={styles.partnerHeader}>
          <Pressable
            onPress={onPartnerHeaderPress}
            style={({ pressed }) => [
              styles.partnerHeaderRow,
              { opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text
              style={[
                styles.partnerName,
                {
                  color: palette.text,
                },
              ]}
              numberOfLines={1}
            >
              {selectedPartner?.name}
            </Text>
            <Text
              style={{
                color: palette.subtext,
                fontSize: 20,
              }}
            >
              ⚙
            </Text>
          </Pressable>
          <Text
            style={[styles.partnerTagline, { color: palette.subtext }]}
            numberOfLines={2}
          >
            {selectedPartner?.tagline}
          </Text>
        </View>

        {/* Admins horizontal strip */}
        {selectedPartner?.admins?.length ? (
          <View style={styles.adminsSection}>
            <Text style={[styles.adminsLabel, { color: palette.subtext }]}>
              Admins
            </Text>
            <FlatList
              data={selectedPartner.admins}
              keyExtractor={(a) => a.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.adminsList}
              renderItem={({ item }) => (
                <View style={styles.adminCard}>
                  <View
                    style={[
                      styles.adminAvatar,
                      {
                        backgroundColor: palette.avatarBg,
                        borderColor: palette.borderMuted,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: palette.onAvatar,
                        fontSize: 13,
                        fontWeight: '700',
                      }}
                    >
                      {item.initials}
                    </Text>
                  </View>
                  <Text
                    numberOfLines={1}
                    style={{
                      color: palette.text,
                      fontSize: 11,
                      fontWeight: '600',
                      marginTop: 2,
                    }}
                  >
                    {item.name}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      color: palette.subtext,
                      fontSize: 10,
                      marginTop: 1,
                    }}
                  >
                    {item.position}
                  </Text>
                </View>
              )}
            />
          </View>
        ) : null}

        {/* Standalone groups */}
        <View style={styles.sectionHeaderRow}>
          <Text
            style={[
              styles.sectionHeaderText,
              { color: palette.text },
            ]}
          >
            Groups
          </Text>
          <Text
            style={[
              styles.sectionHeaderMeta,
              { color: palette.subtext },
            ]}
          >
            {rootGroups.length} groups
          </Text>
        </View>

        {rootGroups.length === 0 ? (
          <Text
            style={{
              color: palette.subtext,
              fontSize: 13,
              marginBottom: 8,
            }}
          >
            No standalone groups yet.
          </Text>
        ) : (
          rootGroups.map((item) => {
            const isSelected = item.id === selectedGroupId;
            return (
              <Pressable
                key={item.id}
                onPress={() => onGroupPress(item.id)}
                style={({ pressed }) => [
                  styles.groupRow,
                  {
                    backgroundColor: isSelected
                      ? palette.primarySoft
                      : 'transparent',
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <View style={styles.groupHash}>
                  <Text
                    style={{
                      color: palette.subtext,
                      fontSize: 15,
                      fontWeight: '700',
                    }}
                  >
                    #
                  </Text>
                </View>
                <Text
                  style={{
                    flex: 1,
                    color: isSelected
                      ? palette.primaryStrong
                      : palette.text,
                    fontSize: 14,
                    fontWeight: isSelected ? '700' : '400',
                  }}
                  numberOfLines={1}
                >
                  {item.name.replace(/^#\s*/i, '')}
                </Text>
              </Pressable>
            );
          })
        )}

        {/* Communities */}
        {communitiesForPartner.length > 0 && (
          <>
            <View style={[styles.sectionHeaderRow, { marginTop: 12 }]}>
              <Text
                style={[
                  styles.sectionHeaderText,
                  { color: palette.text },
                ]}
              >
                Communities
              </Text>
              <Text
                style={[
                  styles.sectionHeaderMeta,
                  { color: palette.subtext },
                ]}
              >
                {communitiesForPartner.length} communities
              </Text>
            </View>

            {communitiesForPartner.map((community) => {
              const isExpanded = expandedCommunities[community.id] ?? true;
              const communityGroups = groupsForPartner.filter(
                (g) => g.communityId === community.id
              );

              if (!communityGroups.length) return null;

              return (
                <View
                  key={community.id}
                  style={[
                    styles.communityCard,
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.borderMuted,
                    },
                  ]}
                >
                  <Pressable
                    onPress={() => onToggleCommunity(community.id)}
                    style={({ pressed }) => [
                      styles.communityHeaderRow,
                      { opacity: pressed ? 0.8 : 1 },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: palette.text,
                          fontSize: 14,
                          fontWeight: '700',
                        }}
                        numberOfLines={1}
                      >
                        {community.name}
                      </Text>
                      {community.description ? (
                        <Text
                          style={{
                            color: palette.subtext,
                            fontSize: 12,
                            marginTop: 2,
                          }}
                          numberOfLines={2}
                        >
                          {community.description}
                        </Text>
                      ) : null}
                    </View>
                    <Text
                      style={{
                        color: palette.subtext,
                        fontSize: 16,
                        marginLeft: 8,
                      }}
                    >
                      {isExpanded ? '⌄' : '›'}
                    </Text>
                  </Pressable>

                  {isExpanded &&
                    communityGroups.map((group) => {
                      const isSelected = group.id === selectedGroupId;
                      return (
                        <Pressable
                          key={group.id}
                          onPress={() => onGroupPress(group.id)}
                          style={({ pressed }) => [
                            styles.communityGroupRow,
                            {
                              backgroundColor: isSelected
                                ? palette.primarySoft
                                : 'transparent',
                              opacity: pressed ? 0.8 : 1,
                            },
                          ]}
                        >
                          <View style={styles.groupHash}>
                            <Text
                              style={{
                                color: palette.subtext,
                                fontSize: 15,
                                fontWeight: '700',
                              }}
                            >
                              #
                            </Text>
                          </View>
                          <Text
                            style={{
                              flex: 1,
                              color: isSelected
                                ? palette.primaryStrong
                                : palette.text,
                              fontSize: 14,
                              fontWeight: isSelected ? '700' : '400',
                            }}
                            numberOfLines={1}
                          >
                            {group.name.replace(/^#\s*/i, '')}
                          </Text>
                        </Pressable>
                      );
                    })}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}
