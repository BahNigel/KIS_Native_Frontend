// src/screens/chat/contactsService.ts

import Contacts, { Contact as RNContact } from 'react-native-contacts';
import { Platform, PermissionsAndroid } from 'react-native';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';

export type KISDeviceContact = {
  id: string;
  name: string;
  phone: string; // normalized phone, e.g. +237676139884
};

export type KISContact = KISDeviceContact & {
  isRegistered: boolean;
};

/**
 * Normalize phone number for backend lookup.
 */
const normalizePhoneForBackend = (phone: string): string => {
  if (!phone) return '';
  let cleaned = phone.replace(/[\s\-().]/g, '');
  if (cleaned.startsWith('00')) cleaned = '+' + cleaned.slice(2);
  if (cleaned.startsWith('+')) return cleaned;
  return cleaned.replace(/\D/g, '');
};

/**
 * Ensure we have contact permissions on both platforms.
 */
async function ensureContactsPermission() {
  // iOS
  if (Platform.OS === 'ios') {
  const req = await Contacts.requestPermission();
    if (req !== 'authorized') {
      throw new Error('Contacts permission denied');
    }

    const perm = await Contacts.checkPermission();
    if (perm === 'authorized') return;
    return;
  }

   const result = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
    PermissionsAndroid.PERMISSIONS.WRITE_CONTACTS,
  ]);

  // ANDROID
  const hasRead = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
  );
  const hasWrite = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.WRITE_CONTACTS,
  );

  if (hasRead && hasWrite) return;


  const readGranted =
    result[PermissionsAndroid.PERMISSIONS.READ_CONTACTS] ===
    PermissionsAndroid.RESULTS.GRANTED;
  const writeGranted =
    result[PermissionsAndroid.PERMISSIONS.WRITE_CONTACTS] ===
    PermissionsAndroid.RESULTS.GRANTED;

  if (!readGranted || !writeGranted) {
    throw new Error('Contacts permission denied');
  }
}

/**
 * FULL REAL IMPLEMENTATION — loads contacts from the user's device.
 */
export async function getDeviceContactsFromDevice(): Promise<KISDeviceContact[]> {
  try {
    await ensureContactsPermission();
  } catch (err) {
    console.warn(`Contacts permission denied: ${String(err)}`);
    return [];
  }

  try {
    const rawContacts = await Contacts.getAll();
    const deviceContacts: KISDeviceContact[] = [];

    for (const c of rawContacts) {
      if (!c.phoneNumbers || c.phoneNumbers.length === 0) continue;

      // pick first phone number
      const rawPhone = c.phoneNumbers[0]?.number || '';
      const cleanedPhone = normalizePhoneForBackend(rawPhone);

      if (!cleanedPhone) continue;

      deviceContacts.push({
        id: c.recordID,
        name: c.displayName || c.givenName || 'Unnamed',
        phone: cleanedPhone,
      });
    }

    return deviceContacts;
  } catch (err) {
    console.warn(`Error loading device contacts: ${String(err)}`);
    return [];
  }
}

/**
 * CHECKS PHONE NUMBERS AGAINST BACKEND
 */
export async function markRegisteredOnBackend(
  deviceContacts: KISDeviceContact[],
): Promise<KISContact[]> {
  const results: KISContact[] = [];
  const BATCH = 50; // tune if needed

  for (let i = 0; i < deviceContacts.length; i += BATCH) {
    const batch = deviceContacts.slice(i, i + BATCH);

    const promises = batch.map(async (contact) => {
      try {
        const url = `${ROUTES.auth.checkContact}?phone=${encodeURIComponent(
          contact.phone,
        )}`;
        const res = await getRequest(url);

        if (!res.success) {
          console.warn(
            `Backend check failed for ${contact.phone} (status: ${res.status} message: ${res.message})`,
          );
          return { ...contact, isRegistered: false };
        }

        const registered = !!res.data?.registered;

        return {
          ...contact,
          isRegistered: registered,
        };
      } catch (e) {
        console.warn(
          `Backend check error for contact ${contact.phone}: ${String(e)}`,
        );
        return { ...contact, isRegistered: false };
      }
    });

    const resolved = await Promise.all(promises);
    results.push(...resolved);
  }

  return results;
}

/**
 * GET DEVICE CONTACTS + MARK REGISTERED USERS
 */
export async function refreshFromDeviceAndBackend(): Promise<KISContact[]> {
  const deviceContacts = await getDeviceContactsFromDevice();
  const marked = await markRegisteredOnBackend(deviceContacts);
  return marked;
}

/**
 * Save manually created contacts back to the device.
 * Called from AddContactForm / AddContactsPage.
 */
export async function saveContactToDevice(payload: {
  name: string;
  phone: string;      // normalized phone, e.g. +237612345678
  countryCode: string; // dial code, e.g. +237 (not strictly needed here)
}): Promise<void> {
  await ensureContactsPermission();

  const newContact: RNContact = {
    recordID: '',
    givenName: payload.name,
    familyName: '',
    phoneNumbers: [
      {
        label: 'mobile',
        number: payload.phone, // what will actually appear in device contacts
      },
    ],
    emailAddresses: [],
  };

  try {
    // Use the Promise-based API (no callback)
    await Contacts.addContact(newContact);
    console.log(
      `Contact saved to device: ${payload.name} (${payload.phone})`,
    );
  } catch (err) {
    console.warn(`Error adding contact to device: ${String(err)}`);
    throw err;
  }
}
